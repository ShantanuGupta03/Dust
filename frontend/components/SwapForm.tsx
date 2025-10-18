'use client';

import { useEffect, useMemo, useState } from 'react';
import { Address, erc20Abi, formatUnits, parseUnits } from 'viem';
import { useAccount, useChainId, usePublicClient, useReadContracts, useWalletClient } from 'wagmi';
import { TOKENS, TokenInfo } from '../lib/tokens';
import { getPrices, getQuote } from '../lib/api';
import { addHistoryItem } from '../lib/storage';

function byUsdAsc(a: { usd: number }, b: { usd: number }) {
  return a.usd - b.usd;
}

export default function SwapForm() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const tokens: TokenInfo[] = useMemo(() => TOKENS[chainId as keyof typeof TOKENS] ?? [], [chainId]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState<string>('');
  const [prices, setPrices] = useState<Record<string, number>>({});

  const contracts = useMemo(() => {
    if (!address) return [];
    return tokens.map((t) => ({
      abi: erc20Abi,
      address: t.address as Address,
      functionName: 'balanceOf' as const,
      args: [address],
    }));
  }, [tokens, address]);

  const { data: balancesData } = useReadContracts({
    contracts: contracts as any,
    query: { enabled: isConnected && contracts.length > 0 },
  });

  const balances = useMemo(() => {
    const map: Record<string, { raw: bigint; formatted: string; usd: number; token: TokenInfo } | undefined> = {};
    tokens.forEach((t, idx) => {
      const res = balancesData?.[idx];
      const raw = (res?.result as bigint) ?? 0n;
      const formatted = formatUnits(raw, t.decimals);
      const price = prices[t.address.toLowerCase()] ?? 0;
      const usd = Number(formatted) * price;
      map[t.address] = { raw, formatted, usd, token: t };
    });
    return map;
  }, [tokens, balancesData, prices]);

  useEffect(() => {
    const addrs = tokens.map((t) => t.address);
    if (addrs.length === 0 || !chainId) return;
    getPrices(chainId, addrs).then(setPrices).catch(() => setPrices({}));
  }, [tokens, chainId]);

  useEffect(() => {
    if (!target && tokens.length > 0) setTarget(tokens[0].address);
  }, [tokens, target]);

  const rows = useMemo(() => {
    return tokens
      .map((t) => balances[t.address]!)
      .filter(Boolean)
      .sort(byUsdAsc);
  }, [balances, tokens]);

  const totalUsd = useMemo(() => rows.reduce((acc, r) => acc + r.usd, 0), [rows]);

  function toggle(addr: string) {
    setSelected((s) => ({ ...s, [addr]: !s[addr] }));
  }

  function selectDust(threshold = 5) {
    const next: Record<string, boolean> = {};
    for (const r of rows) {
      next[r.token.address] = r.usd > 0 && r.usd < threshold;
    }
    setSelected(next);
  }

  async function handleSwap() {
    if (!walletClient || !publicClient || !address) return;
    const selectedTokens = rows.filter((r) => selected[r.token.address]);
    for (const r of selectedTokens) {
      if (r.raw === 0n) continue;
      if (r.token.address.toLowerCase() === target.toLowerCase()) continue;
      try {
        const quote = await getQuote({
          chainId,
          sellToken: r.token.address,
          buyToken: target,
          sellAmount: r.raw.toString(),
          takerAddress: address,
        });

        // Approve if needed
        if (quote.allowanceTarget) {
          const allowance: bigint = (await publicClient.readContract({
            abi: erc20Abi,
            address: r.token.address as Address,
            functionName: 'allowance',
            args: [address, quote.allowanceTarget as Address],
          })) as bigint;
          if (allowance < r.raw) {
            await walletClient.writeContract({
              abi: erc20Abi,
              address: r.token.address as Address,
              functionName: 'approve',
              args: [quote.allowanceTarget as Address, r.raw],
            });
          }
        }

        const hash = await walletClient.sendTransaction({
          to: quote.to as Address,
          data: quote.data as `0x${string}`,
          value: quote.value ? BigInt(quote.value) : 0n,
          chain: undefined,
          account: address,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        addHistoryItem({
          hash,
          chainId,
          sellToken: r.token,
          buyToken: tokens.find((t) => t.address.toLowerCase() === target.toLowerCase())!,
          timestamp: Date.now(),
          status: receipt.status,
        });
      } catch (e) {
        console.error('Swap failed for', r.token.symbol, e);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-neutral-400">Connected chain</div>
          <div className="font-medium">{chainId || 'N/A'}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-400">Total portfolio (tracked)</div>
          <div className="font-medium">${totalUsd.toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => selectDust(5)}>
          Auto-select dust (&lt; $5)
        </button>
        <button className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => setSelected({})}>
          Clear selection
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-neutral-400">Target</span>
          <select
            className="px-2 py-2 rounded bg-neutral-900 border border-neutral-700"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {tokens.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
          <button className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500" onClick={handleSwap} disabled={!isConnected}>
            Swap Selected
          </button>
        </div>
      </div>

      <div className="rounded border border-neutral-800 divide-y divide-neutral-800">
        <div className="grid grid-cols-12 px-3 py-2 text-sm text-neutral-400">
          <div className="col-span-1"></div>
          <div className="col-span-3">Token</div>
          <div className="col-span-4">Balance</div>
          <div className="col-span-4 text-right">USD</div>
        </div>
        {rows.map((r) => (
          <label key={r.token.address} className="grid grid-cols-12 items-center px-3 py-3 hover:bg-neutral-900 cursor-pointer">
            <div className="col-span-1">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={!!selected[r.token.address]}
                onChange={() => toggle(r.token.address)}
              />
            </div>
            <div className="col-span-3 flex items-center gap-2">
              <span className="font-medium">{r.token.symbol}</span>
              <span className="text-neutral-400 text-sm">{r.token.name}</span>
            </div>
            <div className="col-span-4">{Number(r.formatted).toLocaleString()} {r.token.symbol}</div>
            <div className="col-span-4 text-right">${r.usd.toFixed(2)}</div>
          </label>
        ))}
      </div>
    </div>
  );
}
