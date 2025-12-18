import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ethers } from "ethers";

type TokenBalance = {
  contractAddress: string;
  tokenBalance: string; // hex string like "0x..."
  error?: string | null;
};

type BalancesResult = {
  address: string;
  tokenBalances: TokenBalance[];
  pageKey?: string;
};

type MetadataResult = {
  decimals?: number;
  symbol?: string;
  name?: string;
  logo?: string;
};

async function alchemyRpc<T>(
  rpcUrl: string,
  method: string,
  params: any[]
): Promise<T> {
  const r = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const j = await r.json();
  if (!r.ok || j?.error) {
    throw new Error(j?.error?.message || `Alchemy RPC failed: ${r.status}`);
  }
  return j.result as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const address = (req.query.address as string | undefined)?.toString();
    if (!address || !ethers.isAddress(address)) {
      return res.status(400).json({ error: "invalid_address" });
    }

    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "missing_ALCHEMY_API_KEY" });
    }

    const rpcUrl = `https://base-mainnet.g.alchemy.com/v2/${apiKey}`;

    // Tuning knobs (keep fast in prod)
    const maxPages = Math.min(Number(req.query.maxPages ?? 5), 20);
    const metadataConcurrency = 12;

    // 1) Fetch ALL ERC20 balances (paged)
    // Note: alchemy_getTokenBalances is an Alchemy-specific extension method
    // It's not in the standard Ethereum RPC spec but is available on Alchemy
    const allBalances: TokenBalance[] = [];
    let pageKey: string | undefined = undefined;

    try {
      for (let page = 0; page < maxPages; page++) {
        const params = pageKey
          ? [address, "erc20", { pageKey }]
          : [address, "erc20"];

        const result = await alchemyRpc<BalancesResult>(
          rpcUrl,
          "alchemy_getTokenBalances",
          params
        );

        allBalances.push(...(result.tokenBalances || []));
        pageKey = result.pageKey;
        if (!pageKey) break;
      }
    } catch (error: any) {
      // If alchemy_getTokenBalances fails, return empty array
      // This could happen if the method isn't available or API key is invalid
      console.error("Error fetching token balances from Alchemy:", error);
      return res.status(200).json({
        address,
        tokenCount: 0,
        tokens: [],
        nextPageKey: null,
        error: "alchemy_getTokenBalances_failed",
        message: error?.message || "Failed to fetch token balances",
      });
    }

    // Filter to non-zero balances and valid addresses
    const nonZero = allBalances.filter((b) => {
      if (!b?.contractAddress || !ethers.isAddress(b.contractAddress)) return false;
      if (!b?.tokenBalance) return false;
      try {
        return BigInt(b.tokenBalance) > 0n;
      } catch {
        return false;
      }
    });

    // 2) Fetch metadata for each token (server-side; no CORS; no leaked key)
    // basic concurrency limiter
    let i = 0;
    const results: any[] = new Array(nonZero.length);

    const workers = Array.from(
      { length: Math.min(metadataConcurrency, nonZero.length) },
      async () => {
        while (i < nonZero.length) {
          const idx = i++;
          const tb = nonZero[idx];
          const tokenAddr = tb.contractAddress;

          let meta: MetadataResult = {};
          try {
            // Note: alchemy_getTokenMetadata is an Alchemy-specific extension method
            meta = await alchemyRpc<MetadataResult>(
              rpcUrl,
              "alchemy_getTokenMetadata",
              [tokenAddr]
            );
          } catch (error) {
            // If Alchemy metadata fails, we'll use defaults (UNKNOWN token)
            // This is fine - the token will still be discovered with balance
            console.warn(`Failed to get metadata for ${tokenAddr}:`, error);
            meta = {};
          }

          const decimals = Number(meta.decimals ?? 18);
          const balanceBig = BigInt(tb.tokenBalance);
          const balanceFormatted = ethers.formatUnits(balanceBig, decimals);

          results[idx] = {
            address: tokenAddr.toLowerCase(),
            symbol: meta.symbol ?? "UNKNOWN",
            name: meta.name ?? "Unknown Token",
            decimals,
            balance: balanceBig.toString(),
            balanceFormatted,
            valueUSD: 0,
            isDust: false,
          };
        }
      }
    );

    await Promise.all(workers);

    return res.status(200).json({
      address,
      tokenCount: results.length,
      tokens: results.filter(Boolean),
      nextPageKey: pageKey ?? null,
    });
  } catch (e: any) {
    return res.status(500).json({
      error: "alchemy_token_balances_failed",
      message: e?.message ?? "unknown",
    });
  }
}
