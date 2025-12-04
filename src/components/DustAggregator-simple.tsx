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
  const [thresholds, setThresholds] = useState<DustThresholds>(DEFAULT_DUST_THRESHOLDS);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [selectedToToken, setSelectedToToken] = useState(CONVERSION_OPTIONS[0]);
  const [converting, setConverting] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [addingCustomToken, setAddingCustomToken] = useState(false);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);
  const [approving, setApproving] = useState(false);

  const tokenDiscovery = new ComprehensiveTokenDiscovery();
  const dustFilter = new DustTokenFilter({ ...thresholds, usd: 10 }); // Set USD threshold to $10
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
      
      // Check network
      const network = await provider.getNetwork();
      console.log('Current network:', network);
      
      if (network.chainId !== 8453n) { // Base mainnet chain ID
        setError('Please switch to Base network (Chain ID: 8453) to use this app.');
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
  };

  const loadTokens = async () => {
    if (!wallet.address) {
      console.log('No wallet address available');
      return;
    }

    console.log('Starting token loading for address:', wallet.address);
    setLoadingTokens(true);
    setError(null);

    try {
      // Use comprehensive token discovery (gets ALL ERC20 tokens)
      console.log('Starting comprehensive ERC20 token discovery...');
      const userTokens = await tokenDiscovery.discoverAllTokens(wallet.address);
      console.log('Discovered tokens:', userTokens.length);
      
      // Update token values with current prices
      console.log('Updating token values...');
      const tokensWithValues = await priceService.updateTokenValues(userTokens);
      console.log('Tokens with values:', tokensWithValues.length);
      
      // Check liquidity for each token (check against USDC and WETH)
      console.log('Checking liquidity pools for tokens...');
      const tokensWithLiquidity = await Promise.all(
        tokensWithValues.map(async (token) => {
          try {
            const hasLiquidity = await batchSwapService.checkTokenLiquidity(token.address);
            return {
              ...token,
              hasLiquidity,
              liquidityChecked: true,
            };
          } catch (error) {
            console.error(`Error checking liquidity for ${token.symbol}:`, error);
            return {
              ...token,
              hasLiquidity: false,
              liquidityChecked: true,
            };
          }
        })
      );
      console.log(`Liquidity check complete. Swappable: ${tokensWithLiquidity.filter(t => t.hasLiquidity).length}, No liquidity: ${tokensWithLiquidity.filter(t => !t.hasLiquidity).length}`);
      
      // Filter dust tokens (USD value <= $10, including $0.00)
      console.log('Filtering dust tokens (USD <= $10, including $0.00)...');
      const dustTokensList = dustFilter.filterDustTokens(tokensWithLiquidity);
      console.log('Dust tokens found:', dustTokensList.length);
      
      // Mark tokens as dust
      const tokensWithDustFlag = tokensWithLiquidity.map(token => ({
        ...token,
        isDust: dustTokensList.some(dt => dt.address === token.address),
      }));
      
      setTokens(tokensWithDustFlag);
      setDustTokens(dustTokensList);
      
      console.log('✅ Tokens loaded successfully:', tokensWithDustFlag.length);
      console.log('✅ Dust tokens (USD <= $10, including $0.00):', dustTokensList.length);
    } catch (err) {
      console.error('❌ Error loading tokens:', err);
      setError(`Failed to load tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Load tokens when wallet connects
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
    // Only select dust tokens that have liquidity (are swappable)
    const swappableDustAddresses = new Set(
      dustTokens
        .filter(token => token.hasLiquidity !== false) // hasLiquidity is true or undefined (not checked yet)
        .map(token => token.address)
    );
    setSelectedTokens(swappableDustAddresses);
  };

  const clearSelection = () => {
    setSelectedTokens(new Set());
  };

  const batchApproveTokens = async () => {
    if (selectedTokens.size === 0 || !wallet.address || !wallet.provider) return;

    setApproving(true);
    setError(null);

    try {
      const selectedTokenInfos = tokens.filter(token => selectedTokens.has(token.address));
      
      if (selectedTokenInfos.length === 0) {
        setError('No tokens selected');
        return;
      }

      // Get signer from provider
      const signer = await wallet.provider.getSigner();
      
      // Prepare approvals
      const tokenAddresses = selectedTokenInfos
        .map(token => token.address)
        .filter(addr => addr !== '0x0000000000000000000000000000000000000000');
      
      const amounts = selectedTokenInfos
        .filter(token => token.address !== '0x0000000000000000000000000000000000000000')
        .map(token => ethers.parseUnits(token.balanceFormatted, token.decimals));

      // Execute batch approvals
      const txHashes = await batchSwapService.batchApproveTokens(
        tokenAddresses,
        amounts,
        signer
      );

      if (txHashes.length > 0) {
        console.log('Batch approval completed:', txHashes);
        alert(`✅ Batch approval completed! ${txHashes.length} approval transaction(s) executed.\n\nTransaction hashes:\n${txHashes.join('\n')}`);
      } else {
        alert('✅ All tokens are already approved!');
      }
    } catch (err) {
      console.error('Error executing batch approval:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to execute batch approval: ${errorMessage}`);
    } finally {
      setApproving(false);
    }
  };

  const executeConversion = async () => {
    if (selectedTokens.size === 0 || !wallet.address || !wallet.provider) return;

    setConverting(true);
    setError(null);

    try {
      const selectedTokenInfos = tokens.filter(token => selectedTokens.has(token.address));
      
      if (selectedTokenInfos.length === 0) {
        setError('No tokens selected');
        return;
      }

      // Get signer from provider
      const signer = await wallet.provider.getSigner();
      
      // Filter to only swappable tokens (have liquidity)
      const swappableTokens = selectedTokenInfos.filter(token => token.hasLiquidity !== false);
      
      if (swappableTokens.length === 0) {
        setError('No swappable tokens selected. Please select tokens that have Uniswap liquidity pools.');
        return;
      }

      if (swappableTokens.length < selectedTokenInfos.length) {
        const nonSwappableCount = selectedTokenInfos.length - swappableTokens.length;
        console.warn(`${nonSwappableCount} selected tokens don't have liquidity pools and will be skipped`);
      }

      // Prepare swaps
      const swaps = swappableTokens.map((token) => {
        const amountIn = ethers.parseUnits(token.balanceFormatted, token.decimals);
        
        return {
          fromToken: token,
          toToken: selectedToToken,
          amountIn,
        };
      });

      // Execute batch swaps
      const result = await batchSwapService.executeBatchSwaps(
        swaps,
        wallet.address,
        signer,
        slippageTolerance
      );

      const { swapTxHashes, approveTxHashes } = result;

      if (swapTxHashes.length > 0) {
        console.log('Batch swap executed successfully:', swapTxHashes);
        let message = `✅ Batch swap completed!\n\n`;
        if (approveTxHashes.length > 0) {
          message += `Approval transactions: ${approveTxHashes.length}\n${approveTxHashes.join('\n')}\n\n`;
        }
        message += `Swap transactions: ${swapTxHashes.length}\n${swapTxHashes.join('\n')}`;
        alert(message);
        
        // Clear selection and reload tokens
        clearSelection();
        await loadTokens();
      } else if (approveTxHashes.length > 0) {
        // Only approvals happened, no swaps
        setError(`Approvals completed (${approveTxHashes.length} transactions), but swaps failed. Please try converting again.`);
        console.error('Swaps failed after approvals:', approveTxHashes);
      } else {
        setError('No swaps were executed. Please try again.');
      }
    } catch (err) {
      console.error('Error executing batch swap:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to execute batch swap: ${errorMessage}`);
    } finally {
      setConverting(false);
    }
  };

  const addCustomToken = async () => {
    if (!customTokenAddress || !wallet.address) return;

    setAddingCustomToken(true);
    setError(null);

    try {
      console.log('Adding custom token:', customTokenAddress);
      const balance = await tokenDiscovery.getTokenBalance(customTokenAddress, wallet.address);
      
      if (balance !== '0' && balance !== '0x0') {
        const metadata = await tokenDiscovery.getTokenMetadata(customTokenAddress);
        const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
        
        const customToken: TokenInfo = {
          address: customTokenAddress,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals,
          balance,
          balanceFormatted,
          valueUSD: 0,
          isDust: false,
        };
        
        // Update token value
        const tokensWithValue = await priceService.updateTokenValues([customToken]);
        const tokenWithValue = tokensWithValue[0];
        
        // Check liquidity
        console.log('Checking liquidity for custom token...');
        const hasLiquidity = await batchSwapService.checkTokenLiquidity(customTokenAddress);
        const tokenWithLiquidity = {
          ...tokenWithValue,
          hasLiquidity,
          liquidityChecked: true,
        };
        
        // Check if it's a dust token
        const isDust = dustFilter.isDustToken(tokenWithLiquidity);
        
        // Update tokens list
        const updatedTokens = [...tokens, { ...tokenWithLiquidity, isDust }];
        setTokens(updatedTokens);
        
        if (isDust) {
          setDustTokens([...dustTokens, tokenWithLiquidity]);
        }
        
        // Show message about liquidity
        if (!hasLiquidity) {
          setError(`Token added, but no Uniswap liquidity pool found. This token cannot be swapped.`);
        } else {
          setError(null);
        }
        
        console.log('Custom token added:', tokenWithLiquidity);
        setCustomTokenAddress('');
      } else {
        setError('Token not found or has zero balance');
      }
    } catch (err) {
      console.error('Error adding custom token:', err);
      setError('Failed to add custom token. Please check the address.');
    } finally {
      setAddingCustomToken(false);
    }
  };

  if (!wallet.isConnected) {
    return (
      <div className="max-w-md mx-auto">
        <div className="premium-card text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center glow-blue">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-4 text-gradient">Connect Your Wallet</h2>
          <p className="text-gray-300 mb-8 text-lg">
            Connect your wallet to start aggregating dust tokens on Base network
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl backdrop-blur-sm">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={connectWallet}
            disabled={loading}
            className="glossy-button w-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with wallet info */}
      <div className="premium-card flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gradient mb-2">Your Dust Tokens</h2>
          <p className="text-gray-300 font-mono">
            {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
          </p>
        </div>
        <button
          onClick={disconnectWallet}
          className="px-4 py-2 text-sm glass rounded-xl text-gray-200 hover:bg-white/10 transition-all"
        >
          Disconnect
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="premium-card bg-red-500/20 border-red-500/50">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Token Summary */}
      <div className="premium-card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gradient">Token Portfolio</h3>
          <div className="flex space-x-2">
            <button
              onClick={loadTokens}
              disabled={loadingTokens}
              className="glossy-button text-white text-sm px-4 py-2 disabled:opacity-50"
            >
              {loadingTokens ? 'Loading...' : 'Load Tokens'}
            </button>
            <button
              onClick={() => console.log('Current state:', { tokens, dustTokens, wallet })}
              className="glass px-4 py-2 text-sm text-gray-200 rounded-xl hover:bg-white/10"
            >
              Debug
            </button>
          </div>
        </div>

        {/* Add Custom Token */}
        <div className="mb-6 glass rounded-xl p-4">
          <h4 className="font-semibold mb-3 text-gray-200">Add Custom Token</h4>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter token contract address (0x...)"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              className="flex-1 px-4 py-2 glass rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addCustomToken}
              disabled={addingCustomToken || !customTokenAddress}
              className="glossy-button text-white px-4 py-2 disabled:opacity-50"
            >
              {addingCustomToken ? 'Adding...' : 'Add Token'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Add tokens that weren't automatically detected
          </p>
        </div>

        {loadingTokens ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            <p className="mt-4 text-gray-300 text-lg">Loading your tokens...</p>
          </div>
        ) : tokens.length > 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-xl p-5">
                <p className="text-sm text-gray-400 mb-1">Total Tokens</p>
                <p className="text-3xl font-bold text-gradient">{tokens.length}</p>
              </div>
              <div className="glass rounded-xl p-5 dust-accent-strong">
                <p className="text-sm text-yellow-400 mb-1">Dust Tokens (USD ≤ $10)</p>
                <p className="text-3xl font-bold text-yellow-400">{dustTokens.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-200 text-lg">Your Tokens:</h4>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {tokens.map((token, index) => (
                  <div
                    key={index}
                    className={`glass rounded-xl p-4 transition-all ${
                      token.isDust
                        ? 'dust-accent-strong hover:bg-yellow-500/20'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-100">{token.symbol || 'UNKNOWN'}</p>
                        <p className="text-sm text-gray-400">{token.name || 'Unknown Token'}</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">{token.address.slice(0, 8)}...{token.address.slice(-6)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-100">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                        <p className="text-sm text-gray-400">${token.valueUSD.toFixed(2)}</p>
                        {token.isDust && (
                          <span className="inline-block mt-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full border border-yellow-500/50 font-semibold">
                            Dust
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No tokens found in your wallet.</p>
            <p className="text-sm mt-2">Make sure you're connected to Base network</p>
          </div>
        )}
      </div>

      {/* Token Conversion - Batch Swap */}
      {dustTokens.length > 0 && (
        <div className="premium-card border-2 border-blue-500/30">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center glow-blue">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gradient mb-1">Batch Swap Dust Tokens</h3>
              <p className="text-sm text-gray-400">Select multiple tokens and convert them in one transaction</p>
            </div>
          </div>
          
          {/* Token Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-200">Select Tokens to Convert</h4>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllDustTokens}
                  className="glass px-4 py-2 text-sm text-blue-300 rounded-xl hover:bg-blue-500/20 transition-all border-blue-500/30"
                >
                  Select All Dust
                </button>
                <button
                  onClick={clearSelection}
                  className="glass px-4 py-2 text-sm text-gray-300 rounded-xl hover:bg-white/10 transition-all"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dustTokens
                .filter(token => token.hasLiquidity !== false) // Only show swappable tokens
                .map((token, index) => (
                <div
                  key={index}
                  className={`glass rounded-xl p-4 cursor-pointer transition-all ${
                    selectedTokens.has(token.address)
                      ? 'dust-accent-strong hover:bg-yellow-500/30 glow-gold'
                      : 'hover:bg-white/5'
                  }`}
                  onClick={() => toggleTokenSelection(token.address)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTokens.has(token.address)}
                        onChange={() => toggleTokenSelection(token.address)}
                        className="w-5 h-5 text-yellow-600 border-yellow-500/50 rounded focus:ring-yellow-500 bg-gray-800 accent-yellow-500"
                      />
                      <div>
                        <p className="font-semibold text-gray-100">{token.symbol || 'UNKNOWN'}</p>
                        <p className="text-sm text-gray-400">{token.name || 'Unknown Token'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-100">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                      <p className="text-xs text-gray-400">${token.valueUSD.toFixed(2)}</p>
                      {token.hasLiquidity && (
                        <span className="inline-block mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/50">
                          Swappable
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show tokens without liquidity */}
            {dustTokens.filter(token => token.hasLiquidity === false).length > 0 && (
              <div className="mt-4 p-4 glass rounded-xl border border-red-500/30 bg-red-500/10">
                <h5 className="font-semibold text-red-400 mb-2">⚠️ Tokens Without Liquidity</h5>
                <p className="text-sm text-gray-300 mb-3">
                  The following tokens don't have Uniswap liquidity pools and cannot be swapped:
                </p>
                <div className="space-y-2">
                  {dustTokens
                    .filter(token => token.hasLiquidity === false)
                    .map((token, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div>
                          <span className="font-semibold text-gray-200">{token.symbol || 'UNKNOWN'}</span>
                          <span className="text-gray-400 ml-2">{token.name || 'Unknown Token'}</span>
                        </div>
                        <span className="text-red-400">No liquidity pool</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Conversion Settings */}
          {selectedTokens.size > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-300">Convert To</label>
                  <select
                    value={selectedToToken.tokenAddress}
                    onChange={(e) => {
                      const option = CONVERSION_OPTIONS.find(opt => opt.tokenAddress === e.target.value);
                      if (option) setSelectedToToken(option);
                    }}
                    className="w-full px-4 py-2 glass rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CONVERSION_OPTIONS.map((option) => (
                      <option key={option.tokenAddress} value={option.tokenAddress} className="bg-gray-800">
                        {option.symbol} - {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-300">Slippage Tolerance (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={slippageTolerance}
                    onChange={(e) => setSlippageTolerance(parseFloat(e.target.value) || 0.5)}
                    className="w-full px-4 py-2 glass rounded-xl text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedTokens.size > 0 && (
            <div className="space-y-3">
              <button
                onClick={batchApproveTokens}
                disabled={approving || converting}
                className="glass px-6 py-3 w-full text-blue-300 rounded-xl hover:bg-blue-500/20 transition-all border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {approving ? 'Approving...' : `Batch Approve ${selectedTokens.size} Token${selectedTokens.size > 1 ? 's' : ''}`}
              </button>
              <button
                onClick={executeConversion}
                disabled={converting || approving}
                className="glossy-button w-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {converting ? 'Converting...' : `Convert ${selectedTokens.size} Token${selectedTokens.size > 1 ? 's' : ''} to ${selectedToToken.symbol}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DustAggregator;
