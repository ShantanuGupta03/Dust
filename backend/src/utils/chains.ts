export type SupportedChainId = 1 | 8453; // Ethereum, Base

export const chainToSlug: Record<SupportedChainId, string> = {
  1: 'ethereum',
  8453: 'base',
};

export const zeroExHosts: Record<SupportedChainId, string> = {
  1: 'https://api.0x.org',
  8453: 'https://base.api.0x.org',
};

export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId === 1 || chainId === 8453;
}
