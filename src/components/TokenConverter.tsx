import React, { useState, useEffect } from 'react';
import { TokenInfo, ConversionOption, ConversionQuote, CONVERSION_OPTIONS } from '../types/token';
import { TokenConversionService } from '../services/TokenConversionService';
import { Check, X, ArrowRight, Zap, AlertTriangle, Loader2 } from 'lucide-react';

interface TokenConverterProps {
  tokens: TokenInfo[];
  userAddress: string;
}

const TokenConverter: React.FC<TokenConverterProps> = ({ tokens, userAddress }) => {
  const [conversionService] = useState(() => new TokenConversionService());
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedToToken, setSelectedToToken] = useState<ConversionOption>(CONVERSION_OPTIONS[0]);
  const [quotes, setQuotes] = useState<ConversionQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [executing, setExecuting] = useState(false);

  // Update quotes when selection changes
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
      
      console.log('Conversion executed:', txHashes);
      // In a real app, you'd show success message and update the UI
      alert(`Conversion executed! Transaction hashes: ${txHashes.join(', ')}`);
      
      // Clear selection after successful conversion
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
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2" />
          Token Converter
        </h3>

        {/* Token Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium">Select Tokens to Convert</h4>
            <div className="flex space-x-2">
              <button
                onClick={selectAllTokens}
                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
            {tokens.map((token) => (
              <div
                key={token.address}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTokens.has(token.address)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleTokenSelection(token.address)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {selectedTokens.has(token.address) ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <div className="w-4 h-4 border border-border rounded" />
                    )}
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-sm text-muted-foreground">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{token.balanceFormatted}</p>
                    <p className="text-xs text-muted-foreground">{formatUSD(token.valueUSD)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Convert To</label>
            <select
              value={selectedToToken.tokenAddress}
              onChange={(e) => {
                const option = CONVERSION_OPTIONS.find(opt => opt.tokenAddress === e.target.value);
                if (option) setSelectedToToken(option);
              }}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CONVERSION_OPTIONS.map((option) => (
                <option key={option.tokenAddress} value={option.tokenAddress}>
                  {option.symbol} - {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Slippage Tolerance (%)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="50"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 0.5)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Conversion Preview */}
        {selectedTokens.size > 0 && (
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-medium mb-3">Conversion Preview</h4>
            
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Loading quotes...</span>
              </div>
            ) : quotes.length > 0 ? (
              <div className="space-y-3">
                {quotes.map((quote, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-background rounded-md">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium">{quote.fromToken.symbol}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{quote.toToken.symbol}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{quote.amountOut}</p>
                      <p className="text-xs text-muted-foreground">
                        Impact: {quote.priceImpact}%
                      </p>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Total Value:</span>
                    <span className="font-medium">{formatUSD(totalValueUSD)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Estimated Output:</span>
                    <span className="text-sm">{totalAmountOut.toFixed(6)} {selectedToToken.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gas Estimate:</span>
                    <span className="text-sm">{totalGasEstimate.toFixed(6)} ETH</span>
                  </div>
                </div>

                <button
                  onClick={executeConversion}
                  disabled={executing}
                  className="w-full mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {executing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Executing Conversion...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Convert {selectedTokens.size} Token{selectedTokens.size > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p>Unable to get conversion quotes</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenConverter;
