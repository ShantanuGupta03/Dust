import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ComprehensiveTokenDiscovery } from '../services/ComprehensiveTokenDiscovery';
import { DustTokenFilter } from '../services/DustTokenFilter';
import { PriceService } from '../services/PriceService';
import { BatchSwapService } from '../services/BatchSwapService';
import { TokenInfo, DustThresholds, DEFAULT_DUST_THRESHOLDS, CONVERSION_OPTIONS } from '../types/token';

// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

interface WalletState {
  address: string | null;
  isConnected: boolean;
  provider: ethers.BrowserProvider | null;
}

interface SwapStatus {
  tokenAddress: string;
  symbol: string;
  status: 'pending' | 'checking' | 'approved' | 'swapping' | 'success' | 'failed';
  error?: string;
  txHash?: string;
}

// Icons as components
const WalletIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
  </svg>
);

const SwapIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const RefreshIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clipRule="evenodd" />
  </svg>
);

const CoinsIcon = () => (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const DustAggregator: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    provider: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [dustTokens, setDustTokens] = useState<TokenInfo[]>([]);
  const [thresholds] = useState<DustThresholds>(DEFAULT_DUST_THRESHOLDS);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedToToken, setSelectedToToken] = useState(CONVERSION_OPTIONS[0]);
  const [converting, setConverting] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [addingCustomToken, setAddingCustomToken] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(1.0); // 1% default
  const [swapStatuses, setSwapStatuses] = useState<SwapStatus[]>([]);
  const [checkingLiquidity, setCheckingLiquidity] = useState(false);

  const tokenDiscovery = new ComprehensiveTokenDiscovery();
  const dustFilter = new DustTokenFilter({ ...thresholds, usd: 10 });
  const priceService = new PriceService();
  const batchSwapService = new BatchSwapService();

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('No wallet found. Please install MetaMask or another Web3 wallet.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId !== 8453n) {
        setError('Please switch to Base network (Chain ID: 8453) to use this app.');
        setLoading(false);
        return;
      }
      
      const accounts = await provider.send('eth_requestAccounts', []);
      const address = accounts[0];

      setWallet({
        address,
        isConnected: true,
        provider,
      });

      console.log('Wallet connected:', address);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = () => {
    setWallet({
      address: null,
      isConnected: false,
      provider: null,
    });
    setTokens([]);
    setDustTokens([]);
    setSelectedTokens(new Set());
    setSwapStatuses([]);
  };

  const loadTokens = async () => {
    if (!wallet.address) return;

    setLoadingTokens(true);
    setError(null);

    try {
      // Discover tokens
      const userTokens = await tokenDiscovery.discoverAllTokens(wallet.address);
      
      // Update prices
      const tokensWithValues = await priceService.updateTokenValues(userTokens);
      
      // Filter dust tokens
      const dustTokensList = dustFilter.filterDustTokens(tokensWithValues);
      
      // Mark tokens as dust
      const tokensWithDustFlag = tokensWithValues.map(token => ({
        ...token,
        isDust: dustTokensList.some(dt => dt.address === token.address),
        hasLiquidity: undefined,
        liquidityChecked: false,
      }));
      
      setTokens(tokensWithDustFlag);
      setDustTokens(dustTokensList.map(t => ({ ...t, hasLiquidity: undefined, liquidityChecked: false })));
      
      console.log(`✅ Found ${tokensWithDustFlag.length} tokens, ${dustTokensList.length} dust tokens`);
    } catch (err) {
      console.error('Error loading tokens:', err);
      setError(`Failed to load tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Check liquidity for selected tokens
  const checkLiquidity = async () => {
    if (selectedTokens.size === 0) return;

    setCheckingLiquidity(true);
    setError(null);

    const selectedTokenInfos = dustTokens.filter(t => selectedTokens.has(t.address));
    
    for (const token of selectedTokenInfos) {
      try {
        const amountIn = ethers.parseUnits(token.balanceFormatted, token.decimals);
        const hasLiquidity = await batchSwapService.checkTokenLiquidityWithAmount(
          token.address,
          selectedToToken.tokenAddress,
          amountIn
        );
        
        // Update token in state
        setDustTokens(prev => prev.map(t => 
          t.address === token.address 
            ? { ...t, hasLiquidity, liquidityChecked: true }
            : t
        ));
        setTokens(prev => prev.map(t => 
          t.address === token.address 
            ? { ...t, hasLiquidity, liquidityChecked: true }
            : t
        ));
      } catch (error) {
        console.error(`Error checking liquidity for ${token.symbol}:`, error);
        setDustTokens(prev => prev.map(t => 
          t.address === token.address 
            ? { ...t, hasLiquidity: false, liquidityChecked: true }
            : t
        ));
      }
    }

    setCheckingLiquidity(false);
  };

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      loadTokens();
    }
  }, [wallet.isConnected, wallet.address]);

  const toggleTokenSelection = (tokenAddress: string) => {
    const newSelection = new Set(selectedTokens);
    if (newSelection.has(tokenAddress)) {
      newSelection.delete(tokenAddress);
    } else {
      newSelection.add(tokenAddress);
    }
    setSelectedTokens(newSelection);
  };

  const selectAllDustTokens = () => {
    const dustAddresses = new Set(dustTokens.map(token => token.address));
    setSelectedTokens(dustAddresses);
  };

  const clearSelection = () => {
    setSelectedTokens(new Set());
    setSwapStatuses([]);
  };

  const executeConversion = async () => {
    if (selectedTokens.size === 0 || !wallet.address || !wallet.provider) return;

    setConverting(true);
    setError(null);
    setSwapStatuses([]);

    try {
      const selectedTokenInfos = tokens.filter(token => selectedTokens.has(token.address));
      
      if (selectedTokenInfos.length === 0) {
        setError('No tokens selected');
        setConverting(false);
        return;
      }

      // Initialize swap statuses
      const initialStatuses: SwapStatus[] = selectedTokenInfos.map(token => ({
        tokenAddress: token.address,
        symbol: token.symbol,
        status: 'pending',
      }));
      setSwapStatuses(initialStatuses);

      const signer = await wallet.provider.getSigner();

      // Process swaps one by one
      const successfulSwaps: string[] = [];
      const failedSwaps: string[] = [];

      for (let i = 0; i < selectedTokenInfos.length; i++) {
        const token = selectedTokenInfos[i];
        
        // Update status to checking
        setSwapStatuses(prev => prev.map(s => 
          s.tokenAddress === token.address 
            ? { ...s, status: 'checking' }
            : s
        ));

        try {
          const amountIn = ethers.parseUnits(token.balanceFormatted, token.decimals);
          
          // Check if swap is possible
          const canSwapResult = await batchSwapService.canSwap(token, selectedToToken, amountIn);
          
          if (!canSwapResult.canSwap) {
            setSwapStatuses(prev => prev.map(s => 
              s.tokenAddress === token.address 
                ? { ...s, status: 'failed', error: canSwapResult.reason || 'No liquidity' }
                : s
            ));
            failedSwaps.push(token.symbol);
            continue;
          }

          // Update status to swapping
          setSwapStatuses(prev => prev.map(s => 
            s.tokenAddress === token.address 
              ? { ...s, status: 'swapping' }
              : s
          ));

          // Execute swap
          const txHash = await batchSwapService.executeSwap(
            token,
            selectedToToken,
            amountIn,
            wallet.address,
            signer,
            slippageTolerance
          );

          // Update status to success
          setSwapStatuses(prev => prev.map(s => 
            s.tokenAddress === token.address 
              ? { ...s, status: 'success', txHash }
              : s
          ));
          successfulSwaps.push(token.symbol);

          // Small delay between swaps
          if (i < selectedTokenInfos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error swapping ${token.symbol}:`, error);
          setSwapStatuses(prev => prev.map(s => 
            s.tokenAddress === token.address 
              ? { ...s, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
              : s
          ));
          failedSwaps.push(token.symbol);
        }
      }

      // Show summary
      if (successfulSwaps.length > 0) {
        const message = `✅ Successfully swapped ${successfulSwaps.length} token(s): ${successfulSwaps.join(', ')}`;
        if (failedSwaps.length > 0) {
          setError(`${message}\n\n⚠️ Failed to swap: ${failedSwaps.join(', ')}`);
        } else {
          alert(message);
        }
        
        // Refresh tokens after successful swaps
        await loadTokens();
      } else if (failedSwaps.length > 0) {
        setError(`Failed to swap all selected tokens. No liquidity available.`);
      }
    } catch (err) {
      console.error('Error executing conversion:', err);
      setError(`Failed to execute conversion: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setConverting(false);
    }
  };

  const addCustomToken = async () => {
    if (!customTokenAddress || !wallet.address) return;

    setAddingCustomToken(true);
    setError(null);

    try {
      const balance = await tokenDiscovery.getTokenBalance(customTokenAddress, wallet.address);
      
      if (balance !== '0' && BigInt(balance) > 0n) {
        const metadata = await tokenDiscovery.getTokenMetadata(customTokenAddress);
        const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
        
        const customToken: TokenInfo = {
          address: customTokenAddress.toLowerCase(),
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals,
          balance,
          balanceFormatted,
          valueUSD: 0,
          isDust: false,
        };
        
        const tokensWithValue = await priceService.updateTokenValues([customToken]);
        const tokenWithValue = tokensWithValue[0];
        
        const isDust = dustFilter.isDustToken(tokenWithValue);
        
        // Check if already exists
        if (!tokens.find(t => t.address.toLowerCase() === customTokenAddress.toLowerCase())) {
          setTokens(prev => [...prev, { ...tokenWithValue, isDust }]);
          if (isDust) {
            setDustTokens(prev => [...prev, tokenWithValue]);
          }
        }
        
        setCustomTokenAddress('');
        setError(null);
      } else {
        setError('Token not found or has zero balance');
      }
    } catch (err) {
      setError('Failed to add custom token. Please check the address.');
    } finally {
      setAddingCustomToken(false);
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  const getStatusIcon = (status: SwapStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckIcon />;
      case 'failed':
        return <AlertIcon />;
      case 'checking':
      case 'swapping':
      case 'approved':
        return <div className="dust-spinner w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: SwapStatus['status']) => {
    switch (status) {
      case 'success':
        return 'text-[var(--dust-emerald)]';
      case 'failed':
        return 'text-[var(--dust-ruby)]';
      case 'checking':
      case 'swapping':
      case 'approved':
        return 'text-[var(--dust-gold-400)]';
      default:
        return 'text-dust-muted';
    }
  };

  // Connect Wallet Screen
  if (!wallet.isConnected) {
    return (
      <div className="max-w-lg mx-auto opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
        <div className="dust-card p-10 text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[var(--dust-gold-400)] to-[var(--dust-gold-600)] flex items-center justify-center dust-glow">
            <WalletIcon />
          </div>
          
          <h2 className="dust-heading-lg dust-text-gradient mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-dust-secondary text-lg mb-8 leading-relaxed">
            Connect to start collecting your dust tokens on Base network
          </p>
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[var(--dust-ruby)]/10 border border-[var(--dust-ruby)]/30">
              <p className="text-[var(--dust-ruby)] text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={connectWallet}
            disabled={loading}
            className="dust-btn-primary w-full text-lg py-4 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="dust-spinner" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <WalletIcon />
                <span>Connect Wallet</span>
              </>
            )}
          </button>

          <p className="mt-6 text-dust-muted text-sm">
            Supports MetaMask and other Web3 wallets
          </p>
        </div>
      </div>
    );
  }

  // Main Dashboard
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Wallet Header */}
      <div className="dust-card p-6 opacity-0 animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--dust-gold-400)] to-[var(--dust-gold-600)] flex items-center justify-center">
              <span className="text-lg font-bold text-[var(--dust-black)]">
                {wallet.address?.slice(2, 4).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="dust-heading-md mb-1">Your Portfolio</h2>
              <p className="font-mono text-dust-secondary text-sm">
                {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={disconnectWallet}
            className="dust-btn-ghost text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="dust-card p-4 bg-[var(--dust-ruby)]/10 border-[var(--dust-ruby)]/30">
          <div className="flex items-start gap-3">
            <AlertIcon />
            <p className="text-[var(--dust-ruby)] whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-0 animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
        <div className="dust-stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Total Tokens</p>
              <p className="dust-heading-lg">{tokens.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-sapphire)]/20 flex items-center justify-center">
              <CoinsIcon />
            </div>
          </div>
        </div>

        <div className="dust-stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Dust Tokens</p>
              <p className="dust-heading-lg dust-text-gold">{dustTokens.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-gold-500)]/20 flex items-center justify-center text-[var(--dust-gold-400)]">
              <SparklesIcon />
            </div>
          </div>
          <p className="text-dust-muted text-xs mt-3">Value ≤ $10</p>
        </div>

        <div className="dust-stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Dust Value</p>
              <p className="dust-heading-lg dust-text-gold">
                ${formatNumber(dustTokens.reduce((sum, t) => sum + t.valueUSD, 0))}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-ember)]/20 flex items-center justify-center text-[var(--dust-ember)]">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="dust-stat-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Total Value</p>
              <p className="dust-heading-lg">
                ${formatNumber(tokens.reduce((sum, t) => sum + t.valueUSD, 0))}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-emerald)]/20 flex items-center justify-center text-[var(--dust-emerald)]">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Token Actions */}
      <div className="dust-card p-6 opacity-0 animate-slide-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="dust-heading-md">Token Discovery</h3>
          <button
            onClick={loadTokens}
            disabled={loadingTokens}
            className="dust-btn-primary disabled:opacity-50"
          >
            {loadingTokens ? (
              <>
                <div className="dust-spinner" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <RefreshIcon />
                <span>Scan Tokens</span>
              </>
            )}
          </button>
        </div>

        {/* Add Custom Token */}
        <div className="p-4 rounded-xl bg-[var(--dust-dark)] border border-dust">
          <h4 className="font-semibold text-dust-primary mb-3">Add Custom Token</h4>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Enter token contract address (0x...)"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              className="dust-input flex-1"
            />
            <button
              onClick={addCustomToken}
              disabled={addingCustomToken || !customTokenAddress}
              className="dust-btn-secondary disabled:opacity-50"
            >
              {addingCustomToken ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      {/* Token List */}
      {loadingTokens ? (
        <div className="dust-card p-12 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <div className="dust-spinner w-12 h-12 mx-auto mb-4" />
          <p className="text-dust-secondary text-lg">Discovering your tokens...</p>
          <p className="text-dust-muted text-sm mt-2">This may take a moment</p>
        </div>
      ) : tokens.length > 0 ? (
        <div className="dust-card p-6 opacity-0 animate-slide-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <h3 className="dust-heading-md mb-4">Your Tokens</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {tokens.map((token, index) => (
              <div
                key={token.address}
                className={`dust-token-item ${token.isDust ? 'is-dust' : ''}`}
                style={{ animationDelay: `${0.05 * index}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      token.isDust 
                        ? 'bg-[var(--dust-gold-500)]/20 text-[var(--dust-gold-400)]' 
                        : 'bg-[var(--dust-surface)] text-dust-secondary'
                    }`}>
                      {token.symbol?.slice(0, 2) || '??'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-dust-primary">{token.symbol || 'UNKNOWN'}</p>
                        {token.isDust && (
                          <span className="dust-badge-gold">
                            <SparklesIcon />
                            Dust
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-dust-muted">{token.name || 'Unknown Token'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-dust-primary">
                      {parseFloat(token.balanceFormatted).toFixed(4)}
                    </p>
                    <p className="text-sm text-dust-muted">
                      ${token.valueUSD.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dust-card p-12 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <CoinsIcon />
          <p className="text-dust-secondary text-lg mt-4">No tokens found</p>
          <p className="text-dust-muted text-sm mt-2">Click "Scan Tokens" to discover your tokens</p>
        </div>
      )}

      {/* Batch Swap Section */}
      {dustTokens.length > 0 && (
        <div className="dust-card p-6 border-[var(--dust-gold-500)]/30 opacity-0 animate-slide-up" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--dust-gold-400)] to-[var(--dust-ember)] flex items-center justify-center dust-glow-sm">
              <SwapIcon />
            </div>
            <div>
              <h3 className="dust-heading-md dust-text-gradient">Batch Swap</h3>
              <p className="text-dust-secondary text-sm">Convert dust tokens via 0x DEX aggregator</p>
            </div>
          </div>

          {/* Token Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-dust-primary">Select Tokens</h4>
              <div className="flex gap-2">
                <button onClick={selectAllDustTokens} className="dust-btn-ghost text-sm">
                  Select All
                </button>
                <button onClick={clearSelection} className="dust-btn-ghost text-sm">
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {dustTokens.map((token) => {
                const swapStatus = swapStatuses.find(s => s.tokenAddress === token.address);
                
                return (
                  <div
                    key={token.address}
                    onClick={() => !converting && toggleTokenSelection(token.address)}
                    className={`dust-token-item cursor-pointer ${
                      selectedTokens.has(token.address) ? 'selected' : ''
                    } ${converting ? 'pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          selectedTokens.has(token.address)
                            ? 'bg-[var(--dust-gold-500)] border-[var(--dust-gold-500)]'
                            : 'border-dust-strong'
                        }`}>
                          {selectedTokens.has(token.address) && (
                            <CheckIcon />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-dust-primary">{token.symbol}</p>
                          <p className="text-xs text-dust-muted">{token.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono text-sm text-dust-primary">
                            {parseFloat(token.balanceFormatted).toFixed(4)}
                          </p>
                          <p className="text-xs text-dust-muted">${token.valueUSD.toFixed(2)}</p>
                        </div>
                        {swapStatus && (
                          <div className={`flex items-center gap-2 ${getStatusColor(swapStatus.status)}`}>
                            {getStatusIcon(swapStatus.status)}
                            <span className="text-xs capitalize">{swapStatus.status}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {swapStatus?.error && (
                      <p className="text-xs text-[var(--dust-ruby)] mt-2 pl-9">{swapStatus.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversion Settings */}
          {selectedTokens.size > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-dust-primary mb-2">
                    Convert To
                  </label>
                  <select
                    value={selectedToToken.tokenAddress}
                    onChange={(e) => {
                      const option = CONVERSION_OPTIONS.find(opt => opt.tokenAddress === e.target.value);
                      if (option) setSelectedToToken(option);
                    }}
                    className="dust-select"
                    disabled={converting}
                  >
                    {CONVERSION_OPTIONS.map((option) => (
                      <option key={option.tokenAddress} value={option.tokenAddress}>
                        {option.symbol} - {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dust-primary mb-2">
                    Slippage Tolerance
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="50"
                      value={slippageTolerance}
                      onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 1.0)}
                      className="dust-input pr-10"
                      disabled={converting}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dust-muted">%</span>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-xl bg-[var(--dust-gold-500)]/10 border border-[var(--dust-gold-500)]/20 mb-6">
                <p className="text-sm text-dust-secondary">
                  <span className="text-[var(--dust-gold-400)] font-semibold">Note:</span> Swaps are executed via 0x DEX aggregator which finds the best prices across multiple DEXs. Some tokens may not have liquidity.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={checkLiquidity}
                  disabled={checkingLiquidity || converting || selectedTokens.size === 0}
                  className="dust-btn-secondary w-full disabled:opacity-50"
                >
                  {checkingLiquidity ? (
                    <>
                      <div className="dust-spinner" />
                      <span>Checking Liquidity...</span>
                    </>
                  ) : (
                    `Check Liquidity for ${selectedTokens.size} Token${selectedTokens.size > 1 ? 's' : ''}`
                  )}
                </button>
                <button
                  onClick={executeConversion}
                  disabled={converting || selectedTokens.size === 0}
                  className="dust-btn-primary w-full py-4 text-lg disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <div className="dust-spinner border-[var(--dust-black)]" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <SwapIcon />
                      <span>
                        Convert {selectedTokens.size} Token{selectedTokens.size > 1 ? 's' : ''} to {selectedToToken.symbol}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DustAggregator;
