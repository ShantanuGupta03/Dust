import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BaseTokenService } from '../services/BaseTokenService';
import { DustTokenFilter } from '../services/DustTokenFilter';
import { PriceService } from '../services/PriceService';
import { TokenConversionService } from '../services/TokenConversionService';
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

  const tokenService = new BaseTokenService();
  const dustFilter = new DustTokenFilter(thresholds);
  const priceService = new PriceService();
  const conversionService = new TokenConversionService();

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
      // Use enhanced token discovery
      console.log('Starting comprehensive token discovery...');
      const userTokens = await tokenService.discoverAllTokens(wallet.address);
      console.log('Discovered tokens:', userTokens);
      
      // Update token values with current prices
      console.log('Updating token values...');
      const tokensWithValues = await priceService.updateTokenValues(userTokens);
      console.log('Tokens with values:', tokensWithValues);
      
      // Get ETH price for dust calculation
      console.log('Getting ETH price...');
      const ethPrice = await priceService.getETHPrice();
      console.log('ETH Price:', ethPrice);
      
      // Filter dust tokens
      console.log('Filtering dust tokens...');
      const dustTokensList = dustFilter.filterDustTokens(tokensWithValues, ethPrice);
      console.log('Dust tokens:', dustTokensList);
      
      setTokens(tokensWithValues);
      setDustTokens(dustTokensList);
      
      console.log('✅ Tokens loaded successfully:', tokensWithValues.length);
      console.log('✅ Dust tokens found:', dustTokensList.length);
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
    const dustAddresses = new Set(dustTokens.map(token => token.address));
    setSelectedTokens(dustAddresses);
  };

  const clearSelection = () => {
    setSelectedTokens(new Set());
  };

  const executeConversion = async () => {
    if (selectedTokens.size === 0 || !wallet.address) return;

    setConverting(true);
    setError(null);

    try {
      const selectedTokenInfos = tokens.filter(token => selectedTokens.has(token.address));
      
      // Get conversion quotes
      const quotes = await conversionService.getBatchConversionQuotes(
        selectedTokenInfos,
        selectedToToken,
        0.5 // 0.5% slippage
      );

      // Execute conversions
      const txHashes = await conversionService.executeBatchConversion(
        quotes,
        wallet.address,
        0.5
      );

      console.log('Conversion executed:', txHashes);
      alert(`Conversion executed! Transaction hashes: ${txHashes.join(', ')}`);
      
      // Clear selection and reload tokens
      clearSelection();
      await loadTokens();
    } catch (err) {
      console.error('Error executing conversion:', err);
      setError('Failed to execute conversion. Please try again.');
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
      const customToken = await tokenService.addCustomToken(wallet.address, customTokenAddress);
      
      if (customToken) {
        // Update tokens list
        const updatedTokens = [...tokens, customToken];
        setTokens(updatedTokens);
        
        // Check if it's a dust token
        const ethPrice = await priceService.getETHPrice();
        const isDust = dustFilter.isDustToken(customToken, ethPrice);
        
        if (isDust) {
          setDustTokens([...dustTokens, customToken]);
        }
        
        console.log('Custom token added:', customToken);
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
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Connect your wallet to start aggregating dust tokens on Base network
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={connectWallet}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Your Dust Tokens</h2>
          <p className="text-gray-600">
            Address: {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
          </p>
        </div>
        <button
          onClick={disconnectWallet}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Token Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Token Portfolio</h3>
          <div className="flex space-x-2">
            <button
              onClick={loadTokens}
              disabled={loadingTokens}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingTokens ? 'Loading...' : 'Load Tokens'}
            </button>
            <button
              onClick={() => console.log('Current state:', { tokens, dustTokens, wallet })}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Debug
            </button>
          </div>
        </div>

        {/* Add Custom Token */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">Add Custom Token</h4>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter token contract address (0x...)"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addCustomToken}
              disabled={addingCustomToken || !customTokenAddress}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {addingCustomToken ? 'Adding...' : 'Add Token'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Add tokens that weren't automatically detected
          </p>
        </div>

        {loadingTokens ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading your tokens...</p>
          </div>
        ) : tokens.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Total Tokens</p>
                <p className="text-2xl font-semibold">{tokens.length}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600">Dust Tokens</p>
                <p className="text-2xl font-semibold text-orange-600">{dustTokens.length}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Your Tokens:</h4>
              {tokens.map((token, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    dustTokens.includes(token)
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-sm text-gray-600">{token.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                      <p className="text-sm text-gray-600">${token.valueUSD.toFixed(2)}</p>
                      {dustTokens.includes(token) && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                          Dust
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No tokens found in your wallet.</p>
            <p className="text-sm mt-2">Make sure you're connected to Base network</p>
          </div>
        )}
      </div>

      {/* Token Conversion */}
      {dustTokens.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Convert Dust Tokens</h3>
          
          {/* Token Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Select Tokens to Convert</h4>
              <div className="flex space-x-2">
                <button
                  onClick={selectAllDustTokens}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                >
                  Select All Dust
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {dustTokens.map((token, index) => (
                <div
                  key={index}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTokens.has(token.address)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => toggleTokenSelection(token.address)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedTokens.has(token.address)}
                        onChange={() => toggleTokenSelection(token.address)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium">{token.symbol}</p>
                        <p className="text-sm text-gray-600">{token.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{parseFloat(token.balanceFormatted).toFixed(6)}</p>
                      <p className="text-xs text-gray-600">${token.valueUSD.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion Settings */}
          {selectedTokens.size > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Convert To</label>
                  <select
                    value={selectedToToken.tokenAddress}
                    onChange={(e) => {
                      const option = CONVERSION_OPTIONS.find(opt => opt.tokenAddress === e.target.value);
                      if (option) setSelectedToToken(option);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CONVERSION_OPTIONS.map((option) => (
                      <option key={option.tokenAddress} value={option.tokenAddress}>
                        {option.symbol} - {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Slippage Tolerance</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    defaultValue="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Convert Button */}
          {selectedTokens.size > 0 && (
            <button
              onClick={executeConversion}
              disabled={converting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {converting ? 'Converting...' : `Convert ${selectedTokens.size} Token${selectedTokens.size > 1 ? 's' : ''} to ${selectedToToken.symbol}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DustAggregator;
