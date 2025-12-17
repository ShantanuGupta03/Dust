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
  isDustToken(token: TokenInfo): boolean {
    // Filter: USD value <= $10 (including $0.00)
    // This includes tokens with zero value or very low value
    return token.valueUSD <= this.usdThreshold;
  }

  // Filter tokens to get only dust tokens (USD value <= $10, including $0.00)
  filterDustTokens(tokens: TokenInfo[]): TokenInfo[] {
    return tokens.filter(token => this.isDustToken(token));
  }

  // Set USD threshold
  setUSDThreshold(threshold: number): void {
    this.usdThreshold = threshold;
  }

  // Calculate total dust value
  calculateDustValue(tokens: TokenInfo[]): number {
    const dustTokens = this.filterDustTokens(tokens);
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
