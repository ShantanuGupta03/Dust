import { ethers } from 'ethers';
import { TokenInfo, AggregationResult, DustThresholds } from '../types/token';
import { BaseTokenService, BASE_TOKENS } from './BaseTokenService';
import { DustTokenFilter } from './DustTokenFilter';
import { PriceService } from './PriceService';

export class DustTokenAggregator {
  private tokenService: BaseTokenService;
  private dustFilter: DustTokenFilter;
  private priceService: PriceService;

  constructor() {
    this.tokenService = new BaseTokenService();
    this.dustFilter = new DustTokenFilter();
    this.priceService = new PriceService();
  }

  // Main aggregation function
  async aggregateTokens(userAddress: string, customThresholds?: Partial<DustThresholds>): Promise<AggregationResult> {
    try {
      // Update thresholds if provided
      if (customThresholds) {
        this.dustFilter.updateThresholds(customThresholds);
      }

      // Get all token balances
      const tokenAddresses = Object.values(BASE_TOKENS);
      const tokens = await this.tokenService.getUserTokenBalances(userAddress, tokenAddresses);

      // Update token values with current prices
      const tokensWithValues = await this.priceService.updateTokenValues(tokens);

      // Filter dust tokens
      const dustTokens = this.dustFilter.filterDustTokens(tokensWithValues);

      // Calculate totals
      const totalTokens = tokensWithValues.length;
      const dustTokensCount = dustTokens.length;
      const totalValueUSD = tokensWithValues.reduce((sum, token) => sum + token.valueUSD, 0);
      const dustValueUSD = dustTokens.reduce((sum, token) => sum + token.valueUSD, 0);

      // Estimate gas (simplified)
      const gasEstimate = this.estimateGasCost(dustTokensCount);

      return {
        totalTokens,
        dustTokens: dustTokensCount,
        totalValueUSD,
        dustValueUSD,
        gasEstimate,
        tokens: tokensWithValues,
      };
    } catch (error) {
      console.error('Error aggregating tokens:', error);
      throw new Error('Failed to aggregate tokens');
    }
  }

  // Get dust tokens only
  async getDustTokens(userAddress: string, customThresholds?: Partial<DustThresholds>): Promise<TokenInfo[]> {
    const result = await this.aggregateTokens(userAddress, customThresholds);
    return result.tokens.filter(token => token.isDust);
  }

  // Check if user has any dust tokens
  async hasDustTokens(userAddress: string, customThresholds?: Partial<DustThresholds>): Promise<boolean> {
    const dustTokens = await this.getDustTokens(userAddress, customThresholds);
    return dustTokens.length > 0;
  }

  // Get token discovery suggestions (common Base tokens)
  async getTokenSuggestions(): Promise<string[]> {
    return Object.values(BASE_TOKENS);
  }

  // Add custom token to track
  async addCustomToken(userAddress: string, tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const [metadata, balance] = await Promise.all([
        this.tokenService.getTokenMetadata(tokenAddress),
        this.tokenService.getTokenBalance(tokenAddress, userAddress),
      ]);

      if (balance === '0') {
        return null;
      }

      const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
      const tokens = [{
        address: tokenAddress,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance,
        balanceFormatted,
        valueUSD: 0,
        isDust: false,
        logoURI: metadata.logoURI,
      }];

      const tokensWithValues = await this.priceService.updateTokenValues(tokens);
      return tokensWithValues[0];
    } catch (error) {
      console.error('Error adding custom token:', error);
      return null;
    }
  }

  // Estimate gas cost for aggregation
  private estimateGasCost(tokenCount: number): string {
    // Simplified gas estimation
    // Base transaction: 21,000 gas
    // Per token transfer: ~65,000 gas
    const baseGas = 21000;
    const perTokenGas = 65000;
    const totalGas = baseGas + (tokenCount * perTokenGas);
    
    // Base gas price (in gwei)
    const gasPrice = 0.000000001; // 1 gwei
    const gasCostETH = (totalGas * gasPrice) / 1e9;
    
    return gasCostETH.toFixed(6);
  }

  // Get current thresholds
  getThresholds(): DustThresholds {
    return this.dustFilter.getThresholds();
  }

  // Update thresholds
  updateThresholds(thresholds: Partial<DustThresholds>): void {
    this.dustFilter.updateThresholds(thresholds);
  }
}
