import fetch from 'node-fetch';
import { isSupportedChain, zeroExHosts } from '../utils/chains';

export type QuoteRequest = {
  chainId: number;
  sellToken: string; // ERC20 address or 'ETH' (unsupported here; ERC20 only for MVP)
  buyToken: string; // ERC20 address
  sellAmount: string; // in base units
  takerAddress: string; // user EOA
};

export async function getZeroExQuote(req: QuoteRequest) {
  const { chainId, sellToken, buyToken, sellAmount, takerAddress } = req;
  if (!isSupportedChain(chainId)) throw new Error(`Unsupported chainId ${chainId}`);
  const host = zeroExHosts[chainId];
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount,
    takerAddress,
    intentOnFilling: 'true',
    slippagePercentage: '0.005',
  });
  const url = `${host}/swap/v1/quote?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0x quote failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const json = await res.json();
  return json as {
    to: string;
    data: string;
    value: string;
    gas?: string | number;
    allowanceTarget?: string;
    buyAmount: string;
    sellAmount: string;
    price: string;
    sources?: any[];
    // other fields ignored
  };
}

export type NormalizedQuote = {
  to: string;
  data: string;
  value: string; // hex or decimal string
  allowanceTarget?: string;
  buyAmount: string;
  sellAmount: string;
  price: string;
};

export async function getBestQuote(input: QuoteRequest): Promise<NormalizedQuote> {
  // MVP: use 0x only; optionally add 1inch fallback in future
  const q = await getZeroExQuote(input);
  return {
    to: q.to,
    data: q.data,
    value: q.value ?? '0',
    allowanceTarget: q.allowanceTarget,
    buyAmount: q.buyAmount,
    sellAmount: q.sellAmount,
    price: q.price,
  };
}
