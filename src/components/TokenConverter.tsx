import React, { useState, useEffect } from 'react';
import { TokenInfo, ConversionOption, ConversionQuote, CONVERSION_OPTIONS } from '../types/token';
import { TokenConversionService } from '../services/TokenConversionService';

interface TokenConverterProps {
  tokens: TokenInfo[];
  userAddress: string;
}

// Icons
const SwapIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const TokenConverter: React.FC<TokenConverterProps> = ({ tokens, userAddress }) => {
  const [conversionService] = useState(() => new TokenConversionService());
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedToToken, setSelectedToToken] = useState<ConversionOption>(CONVERSION_OPTIONS[0]);
  const [quotes, setQuotes] = useState<ConversionQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (selectedTokens.size > 0) {
      updateQuotes();
    } else {
      setQuotes([]);
    }
  }, [selectedTokens, selectedToToken, slippageTolerance]);

  const updateQuotes = async () => {
    setLoading(true);
    try {
      const selectedTokenInfos = tokens.filter(token => selectedTokens.has(token.address));
      const newQuotes = await conversionService.getBatchConversionQuotes(
        selectedTokenInfos,
        selectedToToken,
        slippageTolerance
      );
      setQuotes(newQuotes);
    } catch (error) {
      console.error('Error updating quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTokenSelection = (tokenAddress: string) => {
    const newSelection = new Set(selectedTokens);
    if (newSelection.has(tokenAddress)) {
      newSelection.delete(tokenAddress);
    } else {
      newSelection.add(tokenAddress);
    }
    setSelectedTokens(newSelection);
  };

  const selectAllTokens = () => {
    const allAddresses = new Set(tokens.map(token => token.address));
    setSelectedTokens(allAddresses);
  };

  const clearSelection = () => {
    setSelectedTokens(new Set());
  };

  const executeConversion = async () => {
    if (quotes.length === 0) return;

    setExecuting(true);
    try {
      const txHashes = await conversionService.executeBatchConversion(
        quotes,
        userAddress,
        slippageTolerance
      );
      
      alert(`Conversion executed! Transaction hashes: ${txHashes.join(', ')}`);
      clearSelection();
    } catch (error) {
      console.error('Error executing conversion:', error);
      alert('Failed to execute conversion');
    } finally {
      setExecuting(false);
    }
  };

  const totalValueUSD = quotes.reduce((sum, quote) => sum + quote.fromToken.valueUSD, 0);
  const totalAmountOut = quotes.reduce((sum, quote) => sum + parseFloat(quote.amountOut), 0);
  const totalGasEstimate = quotes.reduce((sum, quote) => sum + parseFloat(quote.gasEstimate), 0);

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="dust-card p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--dust-gold-400)] to-[var(--dust-ember)] flex items-center justify-center dust-glow-sm">
          <SwapIcon />
        </div>
        <div>
          <h3 className="dust-heading-md dust-text-gradient">Token Converter</h3>
          <p className="text-dust-secondary text-sm">Batch swap multiple tokens at once</p>
        </div>
      </div>

      {/* Token Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-dust-primary">Select Tokens to Convert</h4>
          <div className="flex gap-2">
            <button onClick={selectAllTokens} className="dust-btn-ghost text-sm">
              Select All
            </button>
            <button onClick={clearSelection} className="dust-btn-ghost text-sm">
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2">
          {tokens.map((token) => (
            <div
              key={token.address}
              className={`dust-token-item cursor-pointer ${
                selectedTokens.has(token.address) ? 'selected' : ''
              }`}
              onClick={() => toggleTokenSelection(token.address)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    selectedTokens.has(token.address)
                      ? 'bg-[var(--dust-gold-500)] border-[var(--dust-gold-500)] text-[var(--dust-black)]'
                      : 'border-dust-strong'
                  }`}>
                    {selectedTokens.has(token.address) && <CheckIcon />}
                  </div>
                  <div>
                    <p className="font-semibold text-dust-primary">{token.symbol}</p>
                    <p className="text-xs text-dust-muted">{token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm text-dust-primary">{token.balanceFormatted}</p>
                  <p className="text-xs text-dust-muted">{formatUSD(token.valueUSD)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-semibold text-dust-primary mb-2">Convert To</label>
          <select
            value={selectedToToken.tokenAddress}
            onChange={(e) => {
              const option = CONVERSION_OPTIONS.find(opt => opt.tokenAddress === e.target.value);
              if (option) setSelectedToToken(option);
            }}
            className="dust-select"
          >
            {CONVERSION_OPTIONS.map((option) => (
              <option key={option.tokenAddress} value={option.tokenAddress}>
                {option.symbol} - {option.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-dust-primary mb-2">Slippage Tolerance</label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 0.5)}
              className="dust-input pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dust-muted">%</span>
          </div>
        </div>
      </div>

      {/* Conversion Preview */}
      {selectedTokens.size > 0 && (
        <div className="p-5 rounded-xl bg-dust-dark border border-dust">
          <h4 className="font-semibold text-dust-primary mb-4">Conversion Preview</h4>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="dust-spinner mr-3" />
              <span className="text-dust-secondary">Loading quotes...</span>
            </div>
          ) : quotes.length > 0 ? (
            <div className="space-y-4">
              {/* Quote List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {quotes.map((quote, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg bg-dust-surface"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-dust-primary">{quote.fromToken.symbol}</span>
                      <ArrowRightIcon />
                      <span className="font-mono text-sm dust-text-gold">{quote.toToken.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-dust-primary">{quote.amountOut}</p>
                      <p className="text-xs text-dust-muted">
                        Impact: {quote.priceImpact}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="dust-divider" />
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-dust-secondary">Total Value</span>
                  <span className="font-semibold text-dust-primary">{formatUSD(totalValueUSD)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-dust-secondary">Estimated Output</span>
                  <span className="font-mono text-sm dust-text-gold">
                    {totalAmountOut.toFixed(6)} {selectedToToken.symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-dust-secondary">Gas Estimate</span>
                  <span className="font-mono text-sm text-dust-primary">
                    {totalGasEstimate.toFixed(6)} ETH
                  </span>
                </div>
              </div>

              {/* Execute Button */}
              <button
                onClick={executeConversion}
                disabled={executing}
                className="dust-btn-primary w-full py-4 text-lg mt-4 disabled:opacity-50"
              >
                {executing ? (
                  <>
                    <div className="dust-spinner border-[var(--dust-black)]" />
                    <span>Executing Conversion...</span>
                  </>
                ) : (
                  <>
                    <SwapIcon />
                    <span>Convert {selectedTokens.size} Token{selectedTokens.size > 1 ? 's' : ''}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-[var(--dust-gold-400)] mx-auto mb-3">
                <WarningIcon />
              </div>
              <p className="text-dust-secondary">Unable to get conversion quotes</p>
              <p className="text-dust-muted text-sm mt-1">Try selecting different tokens</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenConverter;
