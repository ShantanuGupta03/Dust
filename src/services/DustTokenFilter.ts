import { TokenInfo, DustThresholds, DEFAULT_DUST_THRESHOLDS } from '../types/token';
import { ethers } from 'ethers';

export class DustTokenFilter {
  private thresholds: DustThresholds;
  private usdThreshold: number = 10; // USD threshold for dust (<= $10)

  constructor(thresholds: DustThresholds = DEFAULT_DUST_THRESHOLDS) {
    this.thresholds = thresholds;
    this.usdThreshold = 10; // Always use $10 threshold
  }

  // Check if a token is considered "dust" based on USD value (<= $10, including $0.00)
  isDustToken(token: TokenInfo, ethPriceUSD?: number): boolean {
    // Filter: USD value <= $10 (including $0.00)
    // This includes tokens with zero value or very low value
    return token.valueUSD <= this.usdThreshold;
  }

  // Filter tokens to get only dust tokens (USD value <= $10, including $0.00)
  filterDustTokens(tokens: TokenInfo[], ethPriceUSD?: number): TokenInfo[] {
    return tokens.filter(token => this.isDustToken(token, ethPriceUSD));
  }

  // Set USD threshold
  setUSDThreshold(threshold: number): void {
    this.usdThreshold = threshold;
  }

  // Convert token balance to ETH equivalent
  private convertToETH(token: TokenInfo): number {
    if (token.address === '0x0000000000000000000000000000000000000000') {
      // Native ETH
      return parseFloat(token.balanceFormatted);
    }

    // For ERC20 tokens, we need to get the ETH price
    // This is a simplified version - in production you'd use a price oracle
    const balanceInWei = ethers.parseUnits(token.balanceFormatted, token.decimals);
    const balanceInETH = parseFloat(ethers.formatEther(balanceInWei));
    
    // For now, return 0 for non-ETH tokens
    // In production, you'd multiply by the token's ETH price
    return 0;
  }

  // Calculate total dust value
  calculateDustValue(tokens: TokenInfo[], ethPriceUSD: number): number {
    const dustTokens = this.filterDustTokens(tokens, ethPriceUSD);
    return dustTokens.reduce((total, token) => total + token.valueUSD, 0);
  }

  // Update thresholds
  updateThresholds(thresholds: Partial<DustThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  // Get current thresholds
  getThresholds(): DustThresholds {
    return { ...this.thresholds };
  }
}
