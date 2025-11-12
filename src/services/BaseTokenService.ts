import { ethers } from 'ethers';
import { TokenInfo, TokenMetadata, DustThresholds } from '../types/token';

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

// Common Base network token addresses
export const BASE_TOKENS = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  WETH: '0x4200000000000000000000000000000000000006',
};

export class BaseTokenService {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract> = new Map();

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // Get token metadata
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    try {
      // Handle ETH specially
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        };
      }

      const contract = this.getContract(tokenAddress);
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
      ]);

      return {
        name,
        symbol,
        decimals: Number(decimals),
      };
    } catch (error) {
      console.error(`Error fetching metadata for ${tokenAddress}:`, error);
      throw new Error(`Failed to fetch token metadata for ${tokenAddress}`);
    }
  }

  // Get token balance for a user
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (tokenAddress === BASE_TOKENS.ETH) {
        const balance = await this.provider.getBalance(userAddress);
        return balance.toString();
      }

      const contract = this.getContract(tokenAddress);
      const balance = await contract.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      console.error(`Error fetching balance for ${tokenAddress}:`, error);
      return '0';
    }
  }

  // Get all token balances for a user using a more comprehensive approach
  async getUserTokenBalances(userAddress: string, tokenAddresses: string[]): Promise<TokenInfo[]> {
    const tokenInfos: TokenInfo[] = [];

    // First, get ETH balance
    try {
      const ethBalance = await this.getETHBalance(userAddress);
      if (parseFloat(ethBalance) > 0) {
        const ethMetadata = await this.getTokenMetadata('0x0000000000000000000000000000000000000000');
        tokenInfos.push({
          address: '0x0000000000000000000000000000000000000000',
          symbol: ethMetadata.symbol,
          name: ethMetadata.name,
          decimals: ethMetadata.decimals,
          balance: ethers.parseEther(ethBalance).toString(),
          balanceFormatted: ethBalance,
          valueUSD: 0, // Will be calculated separately
          isDust: false, // Will be determined by dust logic
          logoURI: ethMetadata.logoURI,
        });
      }
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
    }

    // Then check ERC20 tokens
    for (const tokenAddress of tokenAddresses) {
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        continue; // Skip ETH as we already handled it
      }

      try {
        const [metadata, balance] = await Promise.all([
          this.getTokenMetadata(tokenAddress),
          this.getTokenBalance(tokenAddress, userAddress),
        ]);

        if (balance !== '0') {
          const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
          
          tokenInfos.push({
            address: tokenAddress,
            symbol: metadata.symbol,
            name: metadata.name,
            decimals: metadata.decimals,
            balance,
            balanceFormatted,
            valueUSD: 0, // Will be calculated separately
            isDust: false, // Will be determined by dust logic
            logoURI: metadata.logoURI,
          });
        }
      } catch (error) {
        console.error(`Error processing token ${tokenAddress}:`, error);
      }
    }

    return tokenInfos;
  }

  // Enhanced token discovery using Base network token lists
  async discoverAllTokens(userAddress: string): Promise<TokenInfo[]> {
    console.log('Starting comprehensive token discovery...');
    
    // Common Base network tokens (expanded list with known tokens)
    const commonTokens = [
      '0x0000000000000000000000000000000000000000', // ETH
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // USDT
      '0x4200000000000000000000000000000000000006', // WETH
      '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // cbETH
      '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
      '0x940181a94A35A4569E4529A3CDfB74e38FD98631', // AERO
      '0x532f355C65c823E596D4F4ece16b9F4E55Bd79ED', // BALD
      '0x3c8B650257cFb5f272f799F5e2b4e65093a11a05', // VELO
      '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', // DAI
      '0x78a087d713Be963B3079a9152D4F0d6B22e8f55', // Sendit
      '0x4C2A0f5a2b7F7738ba8d5Bf0b4F7F4B7F7F7F7F', // toby (placeholder)
      '0x4C2A0f5a2b7F7738ba8d5Bf0b4F7F4B7F7F7F7F', // Based Coin (placeholder)
      '0x4C2A0f5a2b7F7738ba8d5Bf0b4F7F4B7F7F7F7F', // SKYA (placeholder)
    ];

    // Try to get tokens from multiple sources
    const tokenSources = [
      'https://tokens.coingecko.com/base/all.json',
      'https://raw.githubusercontent.com/Uniswap/token-lists/main/src/tokens/base.json',
    ];

    for (const source of tokenSources) {
      try {
        console.log(`Fetching tokens from ${source}...`);
        const response = await fetch(source);
        if (response.ok) {
          const data = await response.json();
          let additionalTokens: string[] = [];
          
          if (data.tokens) {
            additionalTokens = data.tokens.slice(0, 100).map((token: any) => token.address);
          } else if (Array.isArray(data)) {
            additionalTokens = data.slice(0, 100).map((token: any) => token.address);
          }
          
          commonTokens.push(...additionalTokens);
          console.log(`Added ${additionalTokens.length} tokens from ${source}`);
        }
      } catch (error) {
        console.log(`Could not fetch from ${source}:`, error);
      }
    }

    // Remove duplicates and invalid addresses
    const uniqueTokens = [...new Set(commonTokens)].filter(addr => 
      addr && addr !== '0x0000000000000000000000000000000000000000' && 
      addr.length === 42 && addr.startsWith('0x')
    );
    
    // Add ETH back
    uniqueTokens.unshift('0x0000000000000000000000000000000000000000');
    
    console.log('Checking', uniqueTokens.length, 'tokens for balances...');

    return await this.getUserTokenBalances(userAddress, uniqueTokens);
  }

  // Get contract instance
  private getContract(tokenAddress: string): ethers.Contract {
    if (!this.contracts.has(tokenAddress)) {
      // Don't create contract for ETH
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('ETH is not an ERC20 token');
      }
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      this.contracts.set(tokenAddress, contract);
    }
    return this.contracts.get(tokenAddress)!;
  }

  // Get ETH balance
  async getETHBalance(userAddress: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
      return '0';
    }
  }
}
