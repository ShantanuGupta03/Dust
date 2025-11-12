import React from 'react';
import { AggregationResult } from '../types/token';
import { RefreshCw, Coins, DollarSign, Zap, TrendingUp } from 'lucide-react';

interface AggregationSummaryProps {
  result: AggregationResult;
  onRefresh: () => void;
}

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

  const formatETH = (value: number) => {
    return `${value.toFixed(6)} ETH`;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <p className="text-2xl font-semibold">{result.totalTokens}</p>
            </div>
            <Coins className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Dust Tokens</p>
              <p className="text-2xl font-semibold text-orange-600">{result.dustTokens}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-semibold">{formatUSD(result.totalValueUSD)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Dust Value</p>
              <p className="text-2xl font-semibold text-orange-600">{formatUSD(result.dustValueUSD)}</p>
            </div>
            <Zap className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Aggregation Statistics</h3>
          <button
            onClick={onRefresh}
            className="flex items-center px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Token Distribution</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Dust Tokens</span>
                <span className="text-sm font-medium">{result.dustTokens} ({dustPercentage.toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Regular Tokens</span>
                <span className="text-sm font-medium">{result.totalTokens - result.dustTokens} ({100 - dustPercentage.toFixed(1)}%)</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Value Breakdown</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Dust Value</span>
                <span className="text-sm font-medium text-orange-600">{formatUSD(result.dustValueUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Regular Value</span>
                <span className="text-sm font-medium">{formatUSD(result.totalValueUSD - result.dustValueUSD)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gas Estimate */}
        <div className="mt-4 p-3 bg-muted rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Gas Cost</span>
            <span className="text-sm font-medium">{result.gasEstimate} ETH</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AggregationSummary;
