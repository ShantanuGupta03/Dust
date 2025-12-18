import React, { useEffect, useState } from 'react';
import { SwapHistoryService, SwapHistoryEntry } from '../services/SwapHistoryService';

interface HistoryAnalyticsProps {
  walletAddress: string | null;
}

const HistoryAnalytics: React.FC<HistoryAnalyticsProps> = ({ walletAddress }) => {
  const [history, setHistory] = useState<SwapHistoryEntry[]>([]);
  const [analytics, setAnalytics] = useState({
    totalVolume: 0,
    totalSwaps: 0,
    avgSwapValue: 0,
  });

  const historyService = new SwapHistoryService();

  useEffect(() => {
    if (walletAddress) {
      const swapHistory = historyService.getHistoryForWallet(walletAddress);
      const stats = historyService.getAnalytics(walletAddress);
      setHistory(swapHistory);
      setAnalytics(stats);
    }
  }, [walletAddress]);

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
             ` • ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  const getExplorerUrl = (hash: string) => {
    return `https://basescan.org/tx/${hash}`;
  };

  const getTokenEmoji = (symbol: string): string => {
    const emojiMap: Record<string, string> = {
      'SHIB': '🐕',
      'DOGE': '🐕',
      'PEPE': '🐸',
      'FLOKI': '🦊',
      'SUSHI': '🍣',
      'UNI': '🦄',
      'USDC': '💵',
      'ETH': '💎',
      'WETH': '💎',
    };
    return emojiMap[symbol.toUpperCase()] || '🪙';
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Volume */}
        <div className="dust-card p-6 bg-gradient-to-br from-purple-600/20 to-purple-700/20 border-purple-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-dust-text-secondary">Total Volume</p>
              <p className="text-2xl font-bold text-dust-text-primary">{formatUSD(analytics.totalVolume)}</p>
            </div>
          </div>
          <p className="text-xs text-dust-text-muted">Lifetime swapped value</p>
        </div>

        {/* Total Swaps */}
        <div className="dust-card p-6 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border-emerald-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-dust-text-secondary">Total Swaps</p>
              <p className="text-2xl font-bold text-dust-text-primary">{analytics.totalSwaps}</p>
            </div>
          </div>
          <p className="text-xs text-dust-text-muted">Completed transactions</p>
        </div>

        {/* Avg Swap Value */}
        <div className="dust-card p-6 bg-gradient-to-br from-amber-600/20 to-amber-700/20 border-amber-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-dust-text-secondary">Avg Swap Value</p>
              <p className="text-2xl font-bold text-dust-text-primary">{formatUSD(analytics.avgSwapValue)}</p>
            </div>
          </div>
          <p className="text-xs text-dust-text-muted">Per transaction</p>
        </div>
      </div>

      {/* CTA Card */}
      {analytics.totalSwaps > 0 && (
        <div className="dust-card p-6 bg-gradient-to-br from-purple-600/30 to-purple-700/30 border-purple-500/40">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-dust-text-primary mb-2">
                Keep Your Wallet Clean! ✨
              </h3>
              <p className="text-dust-text-secondary">
                You've swapped {formatUSD(analytics.totalVolume)} across {analytics.totalSwaps} transaction{analytics.totalSwaps !== 1 ? 's' : ''}. 
                Got more dust tokens? Keep aggregating to maximize your portfolio value.
              </p>
            </div>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="ml-4 dust-btn-primary px-6 py-3 rounded-xl font-semibold whitespace-nowrap bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 transition-all"
            >
              Swap More Tokens
            </button>
          </div>
        </div>
      )}

      {/* Swap History */}
      <div className="dust-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-dust-text-primary mb-1">Swap History</h3>
            <p className="text-sm text-dust-text-secondary">Track all your completed dust token swaps</p>
          </div>
          <svg className="w-6 h-6 text-dust-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dust-text-secondary mb-2">No swap history yet</p>
            <p className="text-sm text-dust-text-muted">Complete your first swap to see it here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="border-b border-dust-border last:border-0 pb-4 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  {/* From Tokens */}
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex -space-x-2">
                      {entry.fromTokens.slice(0, 3).map((token, idx) => (
                        <div
                          key={idx}
                          className="w-10 h-10 rounded-full bg-dust-elevated border-2 border-dust-dark flex items-center justify-center text-lg"
                          title={`${token.symbol} ${token.amount}`}
                        >
                          {getTokenEmoji(token.symbol)}
                        </div>
                      ))}
                      {entry.fromTokens.length > 3 && (
                        <div className="w-10 h-10 rounded-full bg-dust-elevated border-2 border-dust-dark flex items-center justify-center text-xs text-dust-text-secondary">
                          +{entry.fromTokens.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.fromTokens.map((token, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-1 rounded-full bg-dust-elevated text-dust-text-secondary"
                          >
                            {token.symbol} {formatUSD(token.valueUSD)}
                          </span>
                        ))}
                        <span className="text-dust-text-muted">→</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-dust-sapphire/20 text-dust-sapphire">
                          {entry.toToken.symbol}
                        </span>
                      </div>
                      <p className="text-xs text-dust-text-muted">
                        {entry.fromTokens.length} token{entry.fromTokens.length !== 1 ? 's' : ''} • {formatDate(entry.timestamp)}
                      </p>
                    </div>
                  </div>

                  {/* Value and Hash */}
                  <div className="text-right ml-4">
                    <p className="text-lg font-semibold text-dust-text-primary mb-1">
                      {formatUSD(entry.totalValueUSD)}
                    </p>
                    <a
                      href={getExplorerUrl(entry.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-dust-sapphire hover:text-dust-sapphire/80 transition-colors break-all"
                    >
                      {entry.txHash.slice(0, 8)}...{entry.txHash.slice(-6)}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryAnalytics;

