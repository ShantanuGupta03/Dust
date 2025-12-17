import React from 'react';
import { AggregationResult } from '../types/token';

interface AggregationSummaryProps {
  result: AggregationResult;
  onRefresh: () => void;
}

// Icons
const RefreshIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const CoinsIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" />
  </svg>
);

const DollarIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const GasIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
  </svg>
);

const AggregationSummary: React.FC<AggregationSummaryProps> = ({
  result,
  onRefresh,
}) => {
  const dustPercentage = result.totalTokens > 0 
    ? (result.dustTokens / result.totalTokens) * 100 
    : 0;

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens */}
        <div className="dust-stat-card opacity-0 animate-slide-up stagger-1" style={{ animationFillMode: 'forwards' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Total Tokens</p>
              <p className="dust-heading-lg">{result.totalTokens}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-sapphire)]/20 flex items-center justify-center text-[var(--dust-sapphire)]">
              <CoinsIcon />
            </div>
          </div>
        </div>

        {/* Dust Tokens */}
        <div className="dust-stat-card opacity-0 animate-slide-up stagger-2" style={{ animationFillMode: 'forwards' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Dust Tokens</p>
              <p className="dust-heading-lg dust-text-gold">{result.dustTokens}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-gold-500)]/20 flex items-center justify-center text-[var(--dust-gold-400)]">
              <SparklesIcon />
            </div>
          </div>
        </div>

        {/* Total Value */}
        <div className="dust-stat-card opacity-0 animate-slide-up stagger-3" style={{ animationFillMode: 'forwards' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Total Value</p>
              <p className="dust-heading-lg">{formatUSD(result.totalValueUSD)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-emerald)]/20 flex items-center justify-center text-[var(--dust-emerald)]">
              <DollarIcon />
            </div>
          </div>
        </div>

        {/* Dust Value */}
        <div className="dust-stat-card opacity-0 animate-slide-up stagger-4" style={{ animationFillMode: 'forwards' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Dust Value</p>
              <p className="dust-heading-lg dust-text-gold">{formatUSD(result.dustValueUSD)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-ember)]/20 flex items-center justify-center text-[var(--dust-ember)]">
              <GasIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="dust-card p-6 opacity-0 animate-slide-up stagger-5" style={{ animationFillMode: 'forwards' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="dust-heading-md">Aggregation Statistics</h3>
          <button
            onClick={onRefresh}
            className="dust-btn-primary"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Token Distribution */}
          <div>
            <h4 className="font-semibold text-dust-primary mb-4">Token Distribution</h4>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="dust-progress">
                <div 
                  className="dust-progress-bar" 
                  style={{ width: `${dustPercentage}%` }}
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[var(--dust-gold-500)] to-[var(--dust-ember)]" />
                  <span className="text-sm text-dust-secondary">Dust Tokens</span>
                </div>
                <span className="text-sm font-semibold text-dust-primary">
                  {result.dustTokens} ({dustPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-dust-elevated" />
                  <span className="text-sm text-dust-secondary">Regular Tokens</span>
                </div>
                <span className="text-sm font-semibold text-dust-primary">
                  {result.totalTokens - result.dustTokens} ({(100 - dustPercentage).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Value Breakdown */}
          <div>
            <h4 className="font-semibold text-dust-primary mb-4">Value Breakdown</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg bg-dust-dark">
                <span className="text-sm text-dust-secondary">Dust Value</span>
                <span className="text-sm font-semibold dust-text-gold">
                  {formatUSD(result.dustValueUSD)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-dust-dark">
                <span className="text-sm text-dust-secondary">Regular Value</span>
                <span className="text-sm font-semibold text-dust-primary">
                  {formatUSD(result.totalValueUSD - result.dustValueUSD)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Gas Estimate */}
        <div className="mt-6 p-4 rounded-xl bg-dust-dark border border-dust">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--dust-sapphire)]/20 flex items-center justify-center text-[var(--dust-sapphire)]">
                <GasIcon />
              </div>
              <div>
                <p className="text-sm text-dust-secondary">Estimated Gas Cost</p>
                <p className="text-xs text-dust-muted">For aggregation transaction</p>
              </div>
            </div>
            <span className="font-mono font-semibold text-dust-primary">
              {result.gasEstimate} ETH
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AggregationSummary;
