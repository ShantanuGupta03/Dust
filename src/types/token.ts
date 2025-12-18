export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  valueUSD: number;
  isDust: boolean;
  logoURI?: string;
  hasLiquidity?: boolean; // Whether token has Uniswap liquidity pool
  liquidityChecked?: boolean; // Whether liquidity check has been performed
}

export interface DustToken extends TokenInfo {
  isDust: true;
}

export interface AggregationResult {
  totalTokens: number;
  dustTokens: number;
  totalValueUSD: number;
  dustValueUSD: number;
  gasEstimate: string;
  tokens: TokenInfo[];
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface DustThresholds {
  eth: number; // ETH threshold (e.g., 0.001 ETH)
  usd: number; // USD threshold (e.g., $5)
}

export interface ConversionOption {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface ConversionRequest {
  fromTokens: string[]; // Token addresses to convert from
  toToken: string; // Token address to convert to
  slippageTolerance: number; // Slippage tolerance percentage
}

export interface ConversionQuote {
  fromToken: TokenInfo;
  toToken: ConversionOption;
  amountOut: string;
  priceImpact: number;
  gasEstimate: string;
  route: string[];
}

export const DEFAULT_DUST_THRESHOLDS: DustThresholds = {
  eth: 0.001, // 0.001 ETH
  usd: 5, // $5 USD
};

export const CONVERSION_OPTIONS: ConversionOption[] = [
  {
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    tokenAddress: '0x0000000000000000000000000000000000000000', // ETH
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
  },
  {
    tokenAddress: '0x4200000000000000000000000000000000000006', // WETH
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
  },
];
