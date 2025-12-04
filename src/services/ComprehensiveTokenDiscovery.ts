import { ethers } from 'ethers';
import { TokenInfo, TokenMetadata } from '../types/token';

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

export class ComprehensiveTokenDiscovery {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract> = new Map();
  private basescanApiKey: string = 'MAQN7PR78ADW38QBIX39VF5RRR67KJEW22';

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // Get all ERC20 token addresses on Base network
  async getAllTokenAddresses(userAddress: string): Promise<string[]> {
    console.log('Fetching all ERC20 token addresses on Base network...');
    const tokenAddresses = new Set<string>();

    try {
      // Method 1: Get tokens from user's transfer history (both sent and received)
      const transferUrl = `https://api.basescan.org/api?module=account&action=tokentx&address=${userAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${this.basescanApiKey}`;
      
      console.log('Fetching user token transfers from Basescan API...');
      const transferResponse = await fetch(transferUrl);
      const transferData = await transferResponse.json();

      if (transferData.status === '1' && transferData.result) {
        transferData.result.forEach((tx: any) => {
          if (tx.contractAddress) {
            tokenAddresses.add(tx.contractAddress.toLowerCase());
          }
        });
        console.log(`Found ${tokenAddresses.size} unique tokens from user transfers`);
      }

      // Also check internal transactions for token transfers
      try {
        const internalTxUrl = `https://api.basescan.org/api?module=account&action=txlistinternal&address=${userAddress}&startblock=0&endblock=99999999&sort=asc&apikey=${this.basescanApiKey}`;
        const internalResponse = await fetch(internalTxUrl);
        const internalData = await internalResponse.json();
        
        if (internalData.status === '1' && internalData.result) {
          // Internal transactions might reveal more token interactions
          console.log(`Found ${internalData.result.length} internal transactions`);
        }
      } catch (error) {
        console.log('Could not fetch internal transactions:', error);
      }

      // Method 2: Get popular tokens from Basescan token list
      // We'll use a combination of known token lists and Basescan API
      const knownTokens = [
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
      ];

      knownTokens.forEach(addr => tokenAddresses.add(addr.toLowerCase()));

      // Method 3: Try to get token list from Basescan (if available)
      // Note: Basescan doesn't have a direct "all tokens" endpoint, so we'll use
      // a combination of the user's transfer history and known token lists
      
      // Also fetch from popular token list APIs
      try {
        const tokenListUrl = 'https://tokens.coingecko.com/base/all.json';
        const tokenListResponse = await fetch(tokenListUrl);
        if (tokenListResponse.ok) {
          const tokenListData = await tokenListResponse.json();
          if (tokenListData.tokens) {
            tokenListData.tokens.slice(0, 200).forEach((token: any) => {
              if (token.address) {
                tokenAddresses.add(token.address.toLowerCase());
              }
            });
            console.log(`Added ${tokenListData.tokens.length} tokens from CoinGecko list`);
          }
        }
      } catch (error) {
        console.log('Could not fetch from CoinGecko token list:', error);
      }

    } catch (error) {
      console.error('Error fetching token addresses:', error);
    }

    console.log(`Total unique token addresses to check: ${tokenAddresses.size}`);
    return Array.from(tokenAddresses);
  }

  // Get token metadata (with fallback for tokens without name/symbol)
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

      try {
        const contract = this.getContract(tokenAddress);
        
        // Try to get metadata, but handle cases where it might fail
        const [name, symbol, decimals] = await Promise.all([
          contract.name().catch(() => 'Unknown Token'),
          contract.symbol().catch(() => 'UNKNOWN'),
          contract.decimals().catch(() => 18),
        ]);

        return {
          name: name || 'Unknown Token',
          symbol: symbol || 'UNKNOWN',
          decimals: Number(decimals) || 18,
        };
      } catch (error) {
        // If contract call fails, return default metadata
        console.warn(`Could not fetch metadata for ${tokenAddress}, using defaults`);
        return {
          name: 'Unknown Token',
          symbol: 'UNKNOWN',
          decimals: 18,
        };
      }
    } catch (error) {
      console.error(`Error getting metadata for ${tokenAddress}:`, error);
      return {
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 18,
      };
    }
  }

  // Check if address is a valid contract
  async isValidContract(address: string): Promise<boolean> {
    try {
      const code = await this.provider.getCode(address);
      return code !== '0x' && code !== '0x0';
    } catch (error) {
      return false;
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    try {
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        const balance = await this.provider.getBalance(userAddress);
        return balance.toString();
      }

      // Check if it's a valid contract first
      const isValid = await this.isValidContract(tokenAddress);
      if (!isValid) {
        return '0'; // Not a contract, skip it
      }

      const contract = this.getContract(tokenAddress);
      // Use static call with timeout to avoid hanging
      const balance = await Promise.race([
        contract.balanceOf(userAddress),
        new Promise<bigint>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);
      return balance.toString();
    } catch (error) {
      // Silently skip invalid contracts
      return '0';
    }
  }

  // Discover all tokens with balances using Basescan API (much faster)
  async discoverAllTokens(userAddress: string): Promise<TokenInfo[]> {
    console.log('Starting fast token discovery using Basescan API...');
    
    const tokenInfos: TokenInfo[] = [];
    
    try {
      // Use Basescan API to get all token balances in one call
      // This is MUCH faster than individual RPC calls
      const tokenListUrl = `https://api.basescan.org/api?module=account&action=tokenlist&address=${userAddress}&apikey=${this.basescanApiKey}`;
      
      console.log('Fetching token balances from Basescan API...');
      const response = await fetch(tokenListUrl);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        console.log(`Found ${data.result.length} tokens with balances from Basescan`);
        
        // Process tokens in parallel (with concurrency limit)
        const concurrencyLimit = 10;
        const tokens = data.result;
        
        for (let i = 0; i < tokens.length; i += concurrencyLimit) {
          const batch = tokens.slice(i, i + concurrencyLimit);
          const batchPromises = batch.map(async (tokenData: any) => {
            try {
              const tokenAddress = tokenData.contractAddress?.toLowerCase();
              if (!tokenAddress) return null;
              
              const balance = tokenData.balance || '0';
              if (balance === '0' || balance === '0x0') return null;
              
              // Get metadata (with fallback)
              let metadata;
              try {
                metadata = await this.getTokenMetadata(tokenAddress);
              } catch (error) {
                metadata = {
                  name: tokenData.tokenName || 'Unknown Token',
                  symbol: tokenData.tokenSymbol || 'UNKNOWN',
                  decimals: parseInt(tokenData.tokenDecimal) || 18,
                };
              }
              
              const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
              
              return {
                address: tokenAddress,
                symbol: metadata.symbol,
                name: metadata.name,
                decimals: metadata.decimals,
                balance,
                balanceFormatted,
                valueUSD: 0,
                isDust: false,
                logoURI: metadata.logoURI,
              } as TokenInfo;
            } catch (error) {
              console.error(`Error processing token ${tokenData.contractAddress}:`, error);
              return null;
            }
          });
          
          const results = await Promise.all(batchPromises);
          const validTokens = results.filter(token => token !== null) as TokenInfo[];
          tokenInfos.push(...validTokens);
        }
      }
      
      // Also check ETH balance
      try {
        const ethBalance = await this.provider.getBalance(userAddress);
        if (ethBalance > 0n) {
          tokenInfos.push({
            address: '0x0000000000000000000000000000000000000000',
            symbol: 'ETH',
            name: 'Ethereum',
            decimals: 18,
            balance: ethBalance.toString(),
            balanceFormatted: ethers.formatEther(ethBalance),
            valueUSD: 0,
            isDust: false,
          } as TokenInfo);
        }
      } catch (error) {
        console.error('Error fetching ETH balance:', error);
      }
      
    } catch (error) {
      console.error('Error using Basescan tokenlist API, falling back to individual checks:', error);
      // Fallback to old method if API fails
      const tokenAddresses = await this.getAllTokenAddresses(userAddress);
      console.log(`Fallback: Checking balances for ${tokenAddresses.length} tokens...`);
      
      // Process in smaller batches with parallelization
      const batchSize = 5;
      for (let i = 0; i < tokenAddresses.length; i += batchSize) {
        const batch = tokenAddresses.slice(i, i + batchSize);
        const batchPromises = batch.map(async (tokenAddress) => {
          try {
            const balance = await this.getTokenBalance(tokenAddress, userAddress);
            if (balance !== '0' && balance !== '0x0' && BigInt(balance) > 0n) {
              const metadata = await this.getTokenMetadata(tokenAddress);
              const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
              return {
                address: tokenAddress,
                symbol: metadata.symbol,
                name: metadata.name,
                decimals: metadata.decimals,
                balance,
                balanceFormatted,
                valueUSD: 0,
                isDust: false,
                logoURI: metadata.logoURI,
              } as TokenInfo;
            }
            return null;
          } catch (error) {
            return null;
          }
        });
        
        const results = await Promise.all(batchPromises);
        const validTokens = results.filter(token => token !== null) as TokenInfo[];
        tokenInfos.push(...validTokens);
      }
    }

    console.log(`✅ Discovered ${tokenInfos.length} tokens total`);
    return tokenInfos;
  }

  // Get contract instance
  private getContract(tokenAddress: string): ethers.Contract {
    if (!this.contracts.has(tokenAddress)) {
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
