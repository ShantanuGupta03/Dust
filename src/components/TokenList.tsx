import React, { useState } from 'react';
import { TokenInfo } from '../types/token';
import { ChevronDown, ChevronRight, Copy, ExternalLink, Filter } from 'lucide-react';

interface TokenListProps {
  tokens: TokenInfo[];
}

const TokenList: React.FC<TokenListProps> = ({ tokens }) => {
  const [filter, setFilter] = useState<'all' | 'dust' | 'regular'>('all');
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());

  const filteredTokens = tokens.filter(token => {
    switch (filter) {
      case 'dust':
        return token.isDust;
      case 'regular':
        return !token.isDust;
      default:
        return true;
    }
  });

  const toggleExpanded = (tokenAddress: string) => {
    const newExpanded = new Set(expandedTokens);
    if (newExpanded.has(tokenAddress)) {
      newExpanded.delete(tokenAddress);
    } else {
      newExpanded.add(tokenAddress);
    }
    setExpandedTokens(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBalance = (balance: string, decimals: number) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    return num.toFixed(6);
  };

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Token List</h3>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'dust' | 'regular')}
            className="px-3 py-1 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Tokens ({tokens.length})</option>
            <option value="dust">Dust Tokens ({tokens.filter(t => t.isDust).length})</option>
            <option value="regular">Regular Tokens ({tokens.filter(t => !t.isDust).length})</option>
          </select>
        </div>
      </div>

      {/* Token List */}
      <div className="space-y-2">
        {filteredTokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tokens found matching the current filter.
          </div>
        ) : (
          filteredTokens.map((token) => (
            <div
              key={token.address}
              className={`bg-card border rounded-lg ${
                token.isDust ? 'border-orange-200 bg-orange-50/50' : 'border-border'
              }`}
            >
              <div
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpanded(token.address)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {expandedTokens.has(token.address) ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{token.symbol}</h4>
                        {token.isDust && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                            Dust
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatBalance(token.balanceFormatted, token.decimals)}</p>
                    <p className="text-sm text-muted-foreground">{formatUSD(token.valueUSD)}</p>
                  </div>
                </div>
              </div>

              {expandedTokens.has(token.address) && (
                <div className="px-4 pb-4 border-t border-border bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                      <h5 className="font-medium mb-2">Token Details</h5>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Symbol:</span>
                          <span>{token.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Decimals:</span>
                          <span>{token.decimals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Balance:</span>
                          <span>{token.balanceFormatted}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">Actions</h5>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => copyToClipboard(token.address)}
                          className="flex items-center px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy Address
                        </button>
                        <a
                          href={`https://basescan.org/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View on BaseScan
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TokenList;

