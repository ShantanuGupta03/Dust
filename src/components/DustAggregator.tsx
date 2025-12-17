import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { DustTokenAggregator } from '../services/DustTokenAggregator';
import { AggregationResult, DustThresholds } from '../types/token';
import TokenList from './TokenList';
import ThresholdSettings from './ThresholdSettings';
import AggregationSummary from './AggregationSummary';
import TokenConverter from './TokenConverter';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';

const DustAggregator: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [aggregator] = useState(() => new DustTokenAggregator());
  const [result, setResult] = useState<AggregationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<DustThresholds>(aggregator.getThresholds());

  // Load tokens when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadTokens();
    }
  }, [isConnected, address]);

  const loadTokens = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const aggregationResult = await aggregator.aggregateTokens(address, thresholds);
      setResult(aggregationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdChange = (newThresholds: Partial<DustThresholds>) => {
    const updatedThresholds = { ...thresholds, ...newThresholds };
    setThresholds(updatedThresholds);
    aggregator.updateThresholds(newThresholds);
    
    if (isConnected && address) {
      loadTokens();
    }
  };

  const handleRefresh = () => {
    if (isConnected && address) {
      loadTokens();
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Connect your wallet to start aggregating dust tokens on Base network
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with wallet info */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Your Dust Tokens</h2>
          <p className="text-muted-foreground">
            Address: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
        </div>
        <ConnectButton />
      </div>

      {/* Threshold Settings */}
      <ThresholdSettings
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Loading your tokens...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-destructive mr-2" />
            <span className="text-destructive">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          <AggregationSummary result={result} onRefresh={handleRefresh} />
          <TokenConverter tokens={result.tokens} userAddress={address!} />
          <TokenList tokens={result.tokens} />
        </>
      )}

      {/* Empty State */}
      {result && result.totalTokens === 0 && !loading && (
        <div className="text-center py-12">
          <div className="bg-card border border-border rounded-lg p-8">
            <h3 className="text-xl font-semibold mb-2">No Tokens Found</h3>
            <p className="text-muted-foreground">
              No tokens found in your wallet. Try adding some tokens or check if you're on the correct network.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DustAggregator;
