import React, { useState } from 'react';
import { TokenInfo } from '../types/token';

interface TokenListProps {
  tokens: TokenInfo[];
}

// Icons
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    className={`w-5 h-5 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  </svg>
);

const FilterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" />
  </svg>
);

const TokenList: React.FC<TokenListProps> = ({ tokens }) => {
  const [filter, setFilter] = useState<'all' | 'dust' | 'regular'>('all');
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '< 0.0001';
    return num.toFixed(4);
  };

  const dustCount = tokens.filter(t => t.isDust).length;
  const regularCount = tokens.filter(t => !t.isDust).length;

  return (
    <div className="dust-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="dust-heading-md">Token List</h3>
        <div className="flex items-center gap-3">
          <FilterIcon />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'dust' | 'regular')}
            className="dust-select text-sm py-2"
          >
            <option value="all">All Tokens ({tokens.length})</option>
            <option value="dust">Dust ({dustCount})</option>
            <option value="regular">Regular ({regularCount})</option>
          </select>
        </div>
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {filteredTokens.length === 0 ? (
          <div className="text-center py-12 text-dust-secondary">
            No tokens found matching the current filter.
          </div>
        ) : (
          filteredTokens.map((token, index) => (
            <div
              key={token.address}
              className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                token.isDust 
                  ? 'border-l-4 border-l-[var(--dust-gold-500)] border-[var(--dust-border)] bg-[var(--dust-gold-500)]/5' 
                  : 'border-dust bg-dust-surface'
              }`}
              style={{ animationDelay: `${0.03 * index}s` }}
            >
              {/* Token Row */}
              <div
                className="p-4 cursor-pointer hover:bg-[var(--dust-elevated)] transition-colors"
                onClick={() => toggleExpanded(token.address)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-dust-muted">
                      <ChevronIcon expanded={expandedTokens.has(token.address)} />
                    </div>
                    
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      token.isDust 
                        ? 'bg-[var(--dust-gold-500)]/20 text-[var(--dust-gold-400)]' 
                        : 'bg-dust-elevated text-dust-secondary'
                    }`}>
                      {token.symbol?.slice(0, 2) || '??'}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-dust-primary">{token.symbol}</h4>
                        {token.isDust && (
                          <span className="dust-badge-gold">
                            <SparklesIcon />
                            Dust
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-dust-muted">{token.name}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-mono font-semibold text-dust-primary">
                      {formatBalance(token.balanceFormatted)}
                    </p>
                    <p className="text-sm text-dust-muted">{formatUSD(token.valueUSD)}</p>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedTokens.has(token.address) && (
                <div className="px-4 pb-4 pt-2 border-t border-dust bg-dust-dark/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Token Details */}
                    <div>
                      <h5 className="font-semibold text-dust-primary mb-3">Token Details</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-dust-muted">Symbol</span>
                          <span className="text-dust-primary font-mono">{token.symbol}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dust-muted">Decimals</span>
                          <span className="text-dust-primary font-mono">{token.decimals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-dust-muted">Raw Balance</span>
                          <span className="text-dust-primary font-mono text-xs">{token.balance.slice(0, 20)}...</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <h5 className="font-semibold text-dust-primary mb-3">Actions</h5>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(token.address);
                          }}
                          className="dust-btn-secondary text-sm py-2 px-3"
                        >
                          <CopyIcon />
                          {copiedAddress === token.address ? 'Copied!' : 'Copy Address'}
                        </button>
                        <a
                          href={`https://basescan.org/token/${token.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="dust-btn-secondary text-sm py-2 px-3"
                        >
                          <ExternalLinkIcon />
                          BaseScan
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
