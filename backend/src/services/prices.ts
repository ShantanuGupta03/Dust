import fetch from 'node-fetch';
import { chainToSlug, isSupportedChain, SupportedChainId } from '../utils/chains';

export type PricesRequest = {
  chainId: number;
  tokens: string[]; // ERC20 addresses
};

export type PricesResponse = Record<string, number>; // addressLower -> usdPrice

export async function getTokenPricesUSD(
  chainId: number,
  tokens: string[]
): Promise<PricesResponse> {
  if (!isSupportedChain(chainId)) {
    throw new Error(`Unsupported chainId ${chainId}`);
  }
  const chainSlug = chainToSlug[chainId as SupportedChainId];
  const normalized = tokens
    .filter(Boolean)
    .map((addr) => addr.toLowerCase())
    .filter((a, i, arr) => arr.indexOf(a) === i);
  if (normalized.length === 0) return {};

  const keys = normalized.map((addr) => `${chainSlug}:${addr}`).join(',');
  const url = `https://coins.llama.fi/prices/current/${keys}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch prices: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    coins: Record<string, { price: number } | undefined>;
  };
  const out: PricesResponse = {};
  for (const addr of normalized) {
    const key = `${chainSlug}:${addr}`;
    const price = json.coins[key]?.price;
    if (typeof price === 'number' && isFinite(price)) {
      out[addr] = price;
    }
  }
  return out;
}
