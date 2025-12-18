export interface SwapHistoryEntry {
  id: string;
  timestamp: number;
  fromTokens: Array<{
    symbol: string;
    amount: string;
    valueUSD: number;
  }>;
  toToken: {
    symbol: string;
    amount: string;
    valueUSD: number;
  };
  txHash: string;
  totalValueUSD: number;
}

const STORAGE_KEY = 'dust_swap_history';

export class SwapHistoryService {
  private getHistory(): SwapHistoryEntry[] {
    if (typeof window === 'undefined') return [];
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  private saveHistory(history: SwapHistoryEntry[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  addSwap(entry: Omit<SwapHistoryEntry, 'id' | 'timestamp'>): void {
    const history = this.getHistory();
    const newEntry: SwapHistoryEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    history.unshift(newEntry); // Add to beginning
    this.saveHistory(history);
  }

  getHistoryForWallet(walletAddress: string): SwapHistoryEntry[] {
    // For now, we'll store all swaps. In the future, we can filter by wallet
    return this.getHistory();
  }

  getAnalytics(walletAddress?: string): {
    totalVolume: number;
    totalSwaps: number;
    avgSwapValue: number;
  } {
    const history = walletAddress 
      ? this.getHistoryForWallet(walletAddress)
      : this.getHistory();
    
    const totalVolume = history.reduce((sum, entry) => sum + entry.totalValueUSD, 0);
    const totalSwaps = history.length;
    const avgSwapValue = totalSwaps > 0 ? totalVolume / totalSwaps : 0;

    return {
      totalVolume,
      totalSwaps,
      avgSwapValue,
    };
  }

  clearHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
}

