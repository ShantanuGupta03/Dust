import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';
import { ComprehensiveTokenDiscovery } from '../services/ComprehensiveTokenDiscovery';
import { DustTokenFilter } from '../services/DustTokenFilter';
import { PriceService } from '../services/PriceService';
import { BatchSwapService, FeeBreakdown } from '../services/BatchSwapService';
import { SwapHistoryService } from '../services/SwapHistoryService';
import { TokenInfo, DustThresholds, DEFAULT_DUST_THRESHOLDS, CONVERSION_OPTIONS } from '../types/token';
import { useTheme } from '../contexts/ThemeContext';
import { parseErrorMessage } from '../utils/errorParser';
import SwapSuccessModal from './SwapSuccessModal';
import HistoryAnalytics from './HistoryAnalytics';

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
  // Load thresholds from localStorage or use default
  const [thresholds, setThresholds] = useState<DustThresholds>(() => {
    const saved = localStorage.getItem('dustThresholds');
    if (saved) {
      try {
        return { ...DEFAULT_DUST_THRESHOLDS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_DUST_THRESHOLDS;
      }
    }
    return { ...DEFAULT_DUST_THRESHOLDS, usd: 10 }; // Default to $10
  });
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedToToken, setSelectedToToken] = useState(CONVERSION_OPTIONS[0]);
  const [converting, setConverting] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [addingCustomToken, setAddingCustomToken] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(1.0); // 1% default
  const [swapStatuses, setSwapStatuses] = useState<SwapStatus[]>([]);
  const [checkingLiquidity, setCheckingLiquidity] = useState(false);
  const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap');
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    amountReceived: string;
    tokenSymbol: string;
    usdValue: number;
    txHash: string;
  } | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'symbol'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDustSettings, setShowDustSettings] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const tokenDiscovery = new ComprehensiveTokenDiscovery();
  const priceService = new PriceService();
  const batchSwapService = new BatchSwapService();
  const swapHistoryService = new SwapHistoryService();
  
  // Create dust filter - will be recreated when thresholds change
  const dustFilter = React.useMemo(() => {
    const filter = new DustTokenFilter(thresholds);
    filter.setUSDThreshold(thresholds.usd);
    return filter;
  }, [thresholds]);

  const switchToBaseNetwork = async () => {
    if (!window.ethereum) return false;

    // Base network parameters
    const baseNetworkParams = {
      chainId: '0x2105', // 8453 in hex
      chainName: 'Base',
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
      },
      rpcUrls: ['https://mainnet.base.org'],
      blockExplorerUrls: ['https://basescan.org'],
    };

    try {
      // Try to switch to Base network
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: baseNetworkParams.chainId }],
      });
      return true;
    } catch (switchError: any) {
      // If the chain doesn't exist, add it
      if (switchError.code === 4902 || switchError.code === -32603) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [baseNetworkParams],
          });
          return true;
        } catch (addError) {
          console.error('Error adding Base network:', addError);
          return false;
        }
      }
      console.error('Error switching to Base network:', switchError);
      return false;
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('No wallet found. Please install MetaMask or another Web3 wallet.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Request account access first (this triggers MetaMask popup)
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        setError('Please connect your wallet in MetaMask.');
        setLoading(false);
        return;
      }

      const address = accounts[0];

      // Step 2: Create provider and check network
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      // Step 3: If not on Base, try to switch
      if (network.chainId !== 8453n) {
        setError('Switching to Base network...');
        const switched = await switchToBaseNetwork();
        
        if (!switched) {
          setError('Please switch to Base network (Chain ID: 8453) to use this app. You can add Base network in MetaMask settings.');
          setLoading(false);
          return;
        }

        // Wait a bit for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify we're on Base now
        const newNetwork = await provider.getNetwork();
        if (newNetwork.chainId !== 8453n) {
          setError('Failed to switch to Base network. Please switch manually in MetaMask.');
          setLoading(false);
          return;
        }
      }

      // Step 4: Set wallet state
      setWallet({
        address,
        isConnected: true,
        provider,
      });

      console.log('Wallet connected:', address);
    } catch (err) {
      console.error('Error connecting wallet:', err);
      const errorMsg = parseErrorMessage(err);
      
      // Handle user rejection
      if (errorMsg.includes('rejected') || errorMsg.includes('denied') || errorMsg.includes('User rejected')) {
        setError('Wallet connection was cancelled. Please try again.');
      } else {
        setError(errorMsg || 'Failed to connect wallet. Please try again.');
      }
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

  // Re-filter existing tokens with current threshold (without re-scanning)
  const refilterTokens = useCallback(() => {
    if (tokens.length === 0) return;
    
    // Filter dust tokens with current threshold
    const dustTokensList = dustFilter.filterDustTokens(tokens);
    
    // Mark tokens as dust
    const tokensWithDustFlag = tokens.map(token => ({
      ...token,
      isDust: dustTokensList.some(dt => dt.address === token.address),
    }));
    
    setTokens(tokensWithDustFlag);
    setDustTokens(dustTokensList);
    
    // Only clear selection for tokens that no longer exist in the list
    // Users should be able to select ANY token, not just dust tokens
    const currentTokenAddresses = new Set(tokensWithDustFlag.map(t => t.address));
    setSelectedTokens(prev => {
      const filtered = new Set<string>();
      prev.forEach(addr => {
        // Keep selection if token still exists in the list (regardless of dust status)
        if (currentTokenAddresses.has(addr)) {
          filtered.add(addr);
        }
      });
      return filtered;
    });
    
    console.log(`✅ Re-filtered: ${dustTokensList.length} dust tokens (threshold: $${thresholds.usd})`);
  }, [tokens, dustFilter, thresholds.usd]);

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
      setError(`Failed to load tokens: ${parseErrorMessage(err)}`);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Check liquidity for selected tokens
  const checkLiquidity = async () => {
    if (selectedTokens.size === 0) return;

    setCheckingLiquidity(true);
    setError(null);

    const selectedTokenInfos = tokens.filter(t => selectedTokens.has(t.address));
    
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

  // Re-filter tokens when threshold changes (if tokens are already loaded)
  useEffect(() => {
    if (tokens.length > 0) {
      refilterTokens();
    }
  }, [thresholds.usd, refilterTokens]);

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

          // Get quote with fee breakdown
          const { quote, fee } = await batchSwapService.getSwapQuoteWithFee(token, selectedToToken, amountIn, slippageTolerance, wallet.address!);
          const buyAmount = quote.buyAmount || '0';
          const buyAmountFormatted = ethers.formatUnits(buyAmount, selectedToToken.decimals);
          
          // Log fee for transparency (optional - can be displayed in UI)
          if (fee.enabled) {
            console.log(`💰 Fee: ${fee.bps / 100}% (${fee.feeAmount ? ethers.formatUnits(fee.feeAmount, selectedToToken.decimals) : 'N/A'} ${selectedToToken.symbol})`);
          }
          
          // Estimate USD value (using token's USD value ratio)
          const tokenValueRatio = token.valueUSD / parseFloat(token.balanceFormatted);
          const estimatedUSDValue = parseFloat(buyAmountFormatted) * tokenValueRatio;

          // Execute swap
          const txHash = await batchSwapService.executeSwap(
            token,
            selectedToToken,
            amountIn,
            slippageTolerance,
            signer
          );

          // Update status to success
          setSwapStatuses(prev => prev.map(s => 
            s.tokenAddress === token.address 
              ? { ...s, status: 'success', txHash }
              : s
          ));
          successfulSwaps.push(token.symbol);

          // Calculate USD value for history (will be recalculated properly in summary)
          // For now, use the input token's value as approximation
          swapHistoryService.addSwap({
            fromTokens: [{
              symbol: token.symbol,
              amount: token.balanceFormatted,
              valueUSD: token.valueUSD,
            }],
            toToken: {
              symbol: selectedToToken.symbol,
              amount: buyAmountFormatted,
              valueUSD: token.valueUSD, // Use input value as approximation
            },
            txHash,
            totalValueUSD: token.valueUSD,
          });

          // Small delay between swaps
          if (i < selectedTokenInfos.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`Error swapping ${token.symbol}:`, error);
          const errorMessage = parseErrorMessage(error);
          setSwapStatuses(prev => prev.map(s => 
            s.tokenAddress === token.address 
              ? { ...s, status: 'failed', error: errorMessage }
              : s
          ));
          failedSwaps.push(token.symbol);
        }
      }

      // Show success modal and summary
      if (successfulSwaps.length > 0) {
        // Calculate total received amount (aggregate all successful swaps)
        let totalReceived = 0n;
        
        for (const token of selectedTokenInfos) {
          if (successfulSwaps.includes(token.symbol)) {
            const amountIn = ethers.parseUnits(token.balanceFormatted, token.decimals);
            try {
              const { quote } = await batchSwapService.getSwapQuoteWithFee(token, selectedToToken, amountIn, slippageTolerance, wallet.address!);
              const buyAmount = BigInt(quote.buyAmount || '0');
              totalReceived += buyAmount;
            } catch {
              // Skip if quote fails
            }
          }
        }
        
        const totalReceivedFormatted = ethers.formatUnits(totalReceived, selectedToToken.decimals);
        const totalReceivedNumber = parseFloat(totalReceivedFormatted);
        
        // Get the actual USD price of the output token
        let outputTokenUSDPrice = 0;
        try {
          // For USDC, price is always $1
          if (selectedToToken.symbol === 'USDC') {
            outputTokenUSDPrice = 1;
          } else {
            // For ETH/WETH, get ETH price from PriceService
            const ethPrice = await priceService.getETHPrice();
            outputTokenUSDPrice = ethPrice;
          }
        } catch (error) {
          console.error('Error getting output token price:', error);
          // Fallback prices
          if (selectedToToken.symbol === 'USDC') {
            outputTokenUSDPrice = 1;
          } else {
            // Default ETH price if we can't fetch (approximate)
            outputTokenUSDPrice = 2500;
          }
        }
        
        // Calculate total USD value
        const totalUSDValue = totalReceivedNumber * outputTokenUSDPrice;
        
        // Show success modal (confetti is handled in the modal component)
        const lastSuccessfulSwap = swapStatuses.find(s => s.status === 'success' && s.txHash);
        if (lastSuccessfulSwap) {
          setSuccessModal({
            isOpen: true,
            amountReceived: totalReceivedFormatted,
            tokenSymbol: selectedToToken.symbol,
            usdValue: totalUSDValue,
            txHash: lastSuccessfulSwap.txHash!,
          });
        }
        
        if (failedSwaps.length > 0) {
          setError(`⚠️ Failed to swap: ${failedSwaps.join(', ')}`);
        }
        
        // Refresh tokens after successful swaps
        await loadTokens();
      } else if (failedSwaps.length > 0) {
        setError(`Failed to swap all selected tokens. No liquidity available.`);
      }
    } catch (err) {
      console.error('Error executing conversion:', err);
      setError(parseErrorMessage(err));
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
      setError(parseErrorMessage(err) || 'Failed to add custom token. Please check the address.');
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

  // Filter and sort tokens
  const getFilteredAndSortedTokens = (tokenList: TokenInfo[]): TokenInfo[] => {
    // Filter by search query
    let filtered = tokenList;
    if (tokenSearchQuery.trim()) {
      const query = tokenSearchQuery.toLowerCase().trim();
      filtered = tokenList.filter(token => 
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.address.toLowerCase().includes(query)
      );
    }

    // Sort tokens
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'value':
          comparison = a.valueUSD - b.valueUSD;
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'symbol':
          comparison = (a.symbol || '').localeCompare(b.symbol || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };

  const filteredAndSortedTokens = getFilteredAndSortedTokens(tokens);

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
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[var(--dust-ruby)]/10 to-[var(--dust-ruby)]/5 border border-[var(--dust-ruby)]/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--dust-ruby)]/20 flex items-center justify-center">
                  <AlertIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--dust-ruby)] text-sm leading-relaxed break-words">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-[var(--dust-ruby)]/60 hover:text-[var(--dust-ruby)] transition-colors p-1 rounded hover:bg-[var(--dust-ruby)]/10"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="relative w-12 h-6 rounded-full bg-dust-elevated border border-dust-border transition-all duration-300 hover:border-dust-border-strong focus:outline-none focus:ring-2 focus:ring-dust-gold-500/50"
              aria-label="Toggle theme"
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-dust-gold-400 to-dust-gold-600 transition-transform duration-300 flex items-center justify-center shadow-lg ${
                theme === 'light' ? 'translate-x-6' : 'translate-x-0'
              }`}>
                {theme === 'dark' ? (
                  <svg className="w-3 h-3 text-dust-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-dust-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </div>
            </button>
        <button
          onClick={disconnectWallet}
              className="dust-btn-ghost text-sm"
        >
          Disconnect
        </button>
      </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dust-card p-2 opacity-0 animate-slide-up" style={{ animationDelay: '0.15s', animationFillMode: 'forwards' }}>
        <div className="flex gap-2">
            <button
            onClick={() => setActiveTab('swap')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'swap'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                : 'text-dust-secondary hover:text-dust-primary hover:bg-dust-elevated'
            }`}
          >
            Swap Tokens
            </button>
            <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg'
                : 'text-dust-secondary hover:text-dust-primary hover:bg-dust-elevated'
            }`}
          >
            History & Analytics
            </button>
          </div>
        </div>

      {/* Success Modal */}
      {successModal && (
        <SwapSuccessModal
          isOpen={successModal.isOpen}
          onClose={() => setSuccessModal(null)}
          amountReceived={successModal.amountReceived}
          tokenSymbol={successModal.tokenSymbol}
          usdValue={successModal.usdValue}
          txHash={successModal.txHash}
          onScanMore={() => {
            setSuccessModal(null);
            setActiveTab('swap');
            loadTokens();
          }}
          onDisconnect={disconnectWallet}
        />
      )}

      {/* Dust Threshold Settings Modal */}
      {showDustSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="dust-card max-w-md w-full p-6 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-dust-text-primary">Dust Threshold Settings</h2>
            <button
                onClick={() => setShowDustSettings(false)}
                className="text-dust-text-muted hover:text-dust-text-primary transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dust-text-primary mb-2">
                  Maximum USD Value for Dust Tokens
                </label>
                <p className="text-xs text-dust-text-secondary mb-3">
                  Tokens with a value less than or equal to this amount will be considered "dust"
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dust-text-secondary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={thresholds.usd}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value) || 0;
                      const newThresholds = { ...thresholds, usd: newValue };
                      setThresholds(newThresholds);
                      localStorage.setItem('dustThresholds', JSON.stringify(newThresholds));
                      // Re-filter existing tokens immediately
                      setTimeout(() => refilterTokens(), 100);
                    }}
                    className="dust-input w-full pl-8 pr-4"
                    placeholder="10.00"
                  />
                </div>
        </div>

              <div className="pt-4 border-t border-dust-border-strong">
                <div className="flex items-center gap-2 text-sm text-dust-text-secondary">
                  <svg className="w-5 h-5 text-dust-sapphire" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>Changes will be saved automatically and applied to future scans.</p>
          </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    const defaultThresholds = { ...DEFAULT_DUST_THRESHOLDS, usd: 10 };
                    setThresholds(defaultThresholds);
                    localStorage.setItem('dustThresholds', JSON.stringify(defaultThresholds));
                    setTimeout(() => refilterTokens(), 100);
                  }}
                  className="flex-1 dust-btn-ghost"
                >
                  Reset to Default ($10)
                </button>
                <button
                  onClick={() => {
                    setShowDustSettings(false);
                  }}
                  className="flex-1 dust-btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'history' ? (
        <HistoryAnalytics walletAddress={wallet.address} />
      ) : (
        <>

      {/* Error Display */}
      {error && (
        <div className="dust-card p-4 bg-gradient-to-r from-[var(--dust-ruby)]/10 to-[var(--dust-ruby)]/5 border border-[var(--dust-ruby)]/30 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--dust-ruby)]/20 flex items-center justify-center">
              <AlertIcon />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[var(--dust-ruby)] font-semibold mb-1">Error</h4>
              <p className="text-[var(--dust-ruby)] text-sm leading-relaxed break-words">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 text-[var(--dust-ruby)]/60 hover:text-[var(--dust-ruby)] transition-colors p-1 rounded hover:bg-[var(--dust-ruby)]/10"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

        <button
          onClick={() => setShowDustSettings(true)}
          className="dust-stat-card cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-dust-secondary text-sm mb-2">Dust Tokens</p>
              <p className="dust-heading-lg dust-text-gold">{dustTokens.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[var(--dust-gold-500)]/20 flex items-center justify-center text-[var(--dust-gold-400)]">
              <SparklesIcon />
          </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-dust-muted text-xs">Value ≤ ${thresholds.usd.toFixed(2)}</p>
            <svg className="w-4 h-4 text-dust-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
      </div>
        </button>

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
            <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="dust-heading-md">Your Tokens</h3>
              {selectedTokens.size > 0 && (
                <p className="text-sm text-dust-text-secondary mt-1">
                  {selectedTokens.size} token{selectedTokens.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dust-secondary">
                {filteredAndSortedTokens.length} of {tokens.length}
              </span>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-dust-border">
            <div className="flex gap-2">
              {selectedTokens.size < tokens.length && (
                <>
                  <button
                    onClick={selectAllTokens}
                    className="dust-btn-ghost text-sm px-3 py-1.5"
                    title="Select all tokens"
                  >
                    Select All ({tokens.length})
                  </button>
                  {dustTokens.length > 0 && (
                <button
                  onClick={selectAllDustTokens}
                      className="dust-btn-ghost text-sm px-3 py-1.5"
                      title={`Select all ${dustTokens.length} dust tokens`}
                >
                      Select All Dust ({dustTokens.length})
                </button>
                  )}
                </>
              )}
              {selectedTokens.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="dust-btn-ghost text-sm px-3 py-1.5"
                >
                  Clear ({selectedTokens.size})
                </button>
              )}
              </div>
            {selectedTokens.size > 0 && (
              <div className="text-right">
                <p className="text-xs text-dust-text-secondary">Total Selected Value</p>
                <p className="text-lg font-bold text-dust-gold-400">
                  ${tokens
                    .filter(t => selectedTokens.has(t.address))
                    .reduce((sum, t) => sum + t.valueUSD, 0)
                    .toFixed(2)}
                </p>
              </div>
            )}
            </div>

          {/* Search and Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by symbol, name, or address..."
                value={tokenSearchQuery}
                onChange={(e) => setTokenSearchQuery(e.target.value)}
                className="dust-input w-full pl-10"
              />
              <svg 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dust-muted"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {tokenSearchQuery && (
                <button
                  onClick={() => setTokenSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dust-muted hover:text-dust-primary transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'value' | 'name' | 'symbol')}
                className="dust-select"
              >
                <option value="value">Sort by Value</option>
                <option value="name">Sort by Name</option>
                <option value="symbol">Sort by Symbol</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="dust-btn-ghost p-2 rounded-lg hover:bg-dust-elevated transition-colors"
                aria-label="Toggle sort order"
                title={sortOrder === 'desc' ? 'High to Low' : 'Low to High'}
              >
                {sortOrder === 'desc' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Token List */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {filteredAndSortedTokens.length > 0 ? (
              filteredAndSortedTokens.map((token, index) => {
                const isSelected = selectedTokens.has(token.address);
                return (
                <div
                    key={token.address}
                    onClick={() => !converting && toggleTokenSelection(token.address)}
                    className={`dust-token-item cursor-pointer transition-all ${
                      token.isDust ? 'is-dust' : ''
                    } ${isSelected ? 'ring-2 ring-[var(--dust-gold-500)] bg-[var(--dust-gold-500)]/5' : ''} ${
                      converting ? 'pointer-events-none opacity-50' : 'hover:bg-dust-elevated'
                    }`}
                    style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Selection Checkbox */}
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isSelected
                            ? 'bg-[var(--dust-gold-500)] border-[var(--dust-gold-500)]'
                            : 'border-dust-border-strong'
                        }`}>
                          {isSelected && (
                            <CheckIcon />
                          )}
                      </div>
                        
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          token.isDust 
                            ? 'bg-[var(--dust-gold-500)]/20 text-[var(--dust-gold-400)]' 
                            : 'bg-[var(--dust-surface)] text-dust-secondary'
                        }`}>
                          {token.symbol?.slice(0, 2) || '??'}
                    </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-dust-primary truncate">{token.symbol || 'UNKNOWN'}</p>
                            {token.isDust && (
                              <span className="dust-badge-gold flex-shrink-0">
                                <SparklesIcon />
                                Dust
                        </span>
                      )}
                    </div>
                          <p className="text-sm text-dust-muted truncate">{token.name || 'Unknown Token'}</p>
                          <a
                            href={`https://basescan.org/address/${token.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-dust-sapphire hover:text-dust-sapphire/80 transition-colors truncate block mt-0.5"
                            title={token.address}
                          >
                            {token.address.slice(0, 6)}...{token.address.slice(-4)}
                            <svg className="w-3 h-3 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                  </div>
                </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-mono font-semibold text-dust-primary">
                          {parseFloat(token.balanceFormatted).toFixed(4)}
                        </p>
                        <p className="text-sm text-dust-muted">
                          ${token.valueUSD.toFixed(2)}
                        </p>
                        </div>
                      {(() => {
                        const swapStatus = swapStatuses.find(s => s.tokenAddress === token.address);
                        return swapStatus ? (
                          <div className={`flex items-center gap-2 ml-3 ${getStatusColor(swapStatus.status)}`}>
                            {getStatusIcon(swapStatus.status)}
                            <span className="text-xs capitalize">{swapStatus.status}</span>
                      </div>
                        ) : null;
                      })()}
                </div>
                    {(() => {
                      const swapStatus = swapStatuses.find(s => s.tokenAddress === token.address);
                      return swapStatus?.error ? (
                        <div className="mt-2 pl-12 pr-2">
                          <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--dust-ruby)]/10 border border-[var(--dust-ruby)]/20">
                            <svg className="w-4 h-4 text-[var(--dust-ruby)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-xs text-[var(--dust-ruby)] leading-relaxed break-words">{swapStatus.error}</p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-dust-secondary">No tokens found matching "{tokenSearchQuery}"</p>
                <button
                  onClick={() => setTokenSearchQuery('')}
                  className="text-sm text-dust-sapphire hover:text-dust-sapphire/80 mt-2"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>

          {/* Swap Controls - Integrated below token list */}
          {selectedTokens.size > 0 && (
            <div className="mt-6 pt-6 border-t border-dust-border">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--dust-gold-400)] to-[var(--dust-ember)] flex items-center justify-center">
                  <SwapIcon />
                </div>
                <div>
                  <h4 className="font-semibold text-dust-primary">Swap Selected Tokens</h4>
                  <p className="text-sm text-dust-secondary">Convert {selectedTokens.size} token{selectedTokens.size !== 1 ? 's' : ''} to {selectedToToken.symbol}</p>
                </div>
              </div>

              {/* Conversion Settings */}
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

              {/* Summary Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[var(--dust-gold-500)]/10 to-[var(--dust-ember)]/10 border border-[var(--dust-gold-500)]/20 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-dust-text-primary">Swap Summary</p>
                  <p className="text-xs text-dust-text-secondary">
                    {selectedTokens.size} token{selectedTokens.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-dust-text-secondary mb-1">Total Value</p>
                    <p className="font-semibold text-dust-text-primary">
                      ${tokens
                        .filter(t => selectedTokens.has(t.address))
                        .reduce((sum, t) => sum + t.valueUSD, 0)
                        .toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-dust-text-secondary mb-1">Converting To</p>
                    <p className="font-semibold text-dust-text-primary">{selectedToToken.symbol}</p>
                  </div>
                </div>
                
                {/* Fee Disclosure */}
                <div className="p-3 rounded-lg bg-[var(--dust-sapphire)]/10 border border-[var(--dust-sapphire)]/20 mb-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-[var(--dust-sapphire)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-dust-text-secondary">
                      <p className="font-semibold text-[var(--dust-sapphire)] mb-1">Platform Fee</p>
                      <p>A small fee (0.1-1.0% based on swap size) is collected to support the platform. This fee is automatically deducted from your output tokens and sent to the fee recipient address.</p>
                    </div>
                  </div>
                </div>

                {/* Wallet Warning Notice */}
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">
                      <p className="font-semibold mb-1">Wallet Security Warning</p>
                      <p>Your wallet may show a "suspicious transaction" warning. This is normal and safe - it appears because the transaction includes a platform fee recipient. The transaction is legitimate and only swaps your tokens. You will receive the output tokens (minus the fee) directly to your wallet.</p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-dust-text-secondary mt-3 pt-3 border-t border-[var(--dust-gold-500)]/20">
                  <span className="text-[var(--dust-gold-400)] font-semibold">ℹ️</span> Swaps use 0x DEX aggregator for best prices. Some tokens may lack liquidity.
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
                  className="dust-btn-primary w-full py-4 text-lg font-bold disabled:opacity-50 relative overflow-hidden group"
                >
                  {converting ? (
                    <>
                      <div className="dust-spinner border-[var(--dust-black)]" />
                      <span>Sweeping {selectedTokens.size} token{selectedTokens.size > 1 ? 's' : ''}...</span>
                    </>
                  ) : (
                    <>
                      <SwapIcon />
                      <span>
                        Sweep {selectedTokens.size} Token{selectedTokens.size > 1 ? 's' : ''} → {selectedToToken.symbol}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        ) : (
        <div className="dust-card p-12 text-center opacity-0 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
          <CoinsIcon />
          <p className="text-dust-secondary text-lg mt-4">No tokens found</p>
          <p className="text-dust-muted text-sm mt-2">Click "Scan Tokens" to discover your tokens</p>
        </div>
        )}
        </>
      )}
    </div>
  );
};

export default DustAggregator;
