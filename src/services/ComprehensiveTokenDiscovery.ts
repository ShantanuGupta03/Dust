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

      const isValid = await this.isValidContract(tokenAddress);
      if (!isValid) {
        return '0';
      }

      const contract = this.getContract(tokenAddress);
      const balance = await Promise.race([
        contract.balanceOf(userAddress),
        new Promise<bigint>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]);
      return balance.toString();
    } catch (error) {
      return '0';
    }
  }

  // Discover all tokens using multiple sources
  async discoverAllTokens(userAddress: string): Promise<TokenInfo[]> {
    console.log('🔍 Starting comprehensive token discovery...');
    
    const tokenMap = new Map<string, TokenInfo>();
    
    // Source 1: Basescan tokenlist API (fastest)
    await this.discoverFromBasescanTokenList(userAddress, tokenMap);
    
    // Source 2: Basescan token transfers (catches more tokens)
    await this.discoverFromTokenTransfers(userAddress, tokenMap);
    
    // Source 3: Check popular Base tokens
    await this.discoverPopularTokens(userAddress, tokenMap);
    
    // Add ETH balance
    await this.addEthBalance(userAddress, tokenMap);
    
    const tokens = Array.from(tokenMap.values());
    console.log(`✅ Discovered ${tokens.length} tokens with balances`);
    
    return tokens;
  }

  // Source 1: Basescan tokenlist API
  private async discoverFromBasescanTokenList(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    try {
      console.log('📋 Fetching from Basescan tokenlist API...');
      const url = `https://api.basescan.org/api?module=account&action=tokenlist&address=${userAddress}&apikey=${this.basescanApiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        console.log(`Found ${data.result.length} tokens from tokenlist`);
        
        for (const tokenData of data.result) {
          const tokenAddress = tokenData.contractAddress?.toLowerCase();
          if (!tokenAddress || tokenMap.has(tokenAddress)) continue;
          
          const balance = tokenData.balance || '0';
          if (balance === '0' || balance === '0x0') continue;
          
          try {
            const decimals = parseInt(tokenData.tokenDecimal) || 18;
            const balanceFormatted = ethers.formatUnits(balance, decimals);
            
            tokenMap.set(tokenAddress, {
              address: tokenAddress,
              symbol: tokenData.tokenSymbol || 'UNKNOWN',
              name: tokenData.tokenName || 'Unknown Token',
              decimals,
              balance,
              balanceFormatted,
              valueUSD: 0,
              isDust: false,
            });
          } catch (error) {
            console.error(`Error processing token ${tokenAddress}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching from tokenlist API:', error);
    }
  }

  // Source 2: Token transfer history (catches more tokens)
  private async discoverFromTokenTransfers(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    try {
      console.log('📜 Fetching from token transfer history...');
      const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${userAddress}&startblock=0&endblock=99999999&sort=desc&page=1&offset=1000&apikey=${this.basescanApiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        // Get unique token addresses from transfers
        const uniqueTokens = new Set<string>();
        data.result.forEach((tx: any) => {
          if (tx.contractAddress) {
            uniqueTokens.add(tx.contractAddress.toLowerCase());
          }
        });
        
        console.log(`Found ${uniqueTokens.size} unique tokens from transfers`);
        
        // Check balances for tokens not already in map
        const tokensToCheck = Array.from(uniqueTokens).filter(addr => !tokenMap.has(addr));
        
        // Process in parallel batches
        const batchSize = 10;
        for (let i = 0; i < tokensToCheck.length; i += batchSize) {
          const batch = tokensToCheck.slice(i, i + batchSize);
          await Promise.all(batch.map(async (tokenAddress) => {
            try {
              const balance = await this.getTokenBalance(tokenAddress, userAddress);
              if (balance !== '0' && BigInt(balance) > 0n) {
                const metadata = await this.getTokenMetadata(tokenAddress);
                const balanceFormatted = ethers.formatUnits(balance, metadata.decimals);
                
                tokenMap.set(tokenAddress, {
                  address: tokenAddress,
                  symbol: metadata.symbol,
                  name: metadata.name,
                  decimals: metadata.decimals,
                  balance,
                  balanceFormatted,
                  valueUSD: 0,
                  isDust: false,
                });
              }
            } catch (error) {
              // Skip failed tokens
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching from token transfers:', error);
    }
  }

  // Source 3: Check popular Base tokens
  private async discoverPopularTokens(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    console.log('🌟 Checking popular Base tokens...');
    
    // Popular tokens on Base that might be missed
    const popularTokens = [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
      { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
      { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', name: 'USD Base Coin', decimals: 6 },
      { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
      { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', symbol: 'AERO', name: 'Aerodrome', decimals: 18 },
      { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', name: 'Coinbase Wrapped ETH', decimals: 18 },
      { address: '0xfA980cEd6895AC314E7dE34Ef1bFAE90a5AdD21b', symbol: 'PRIME', name: 'Echelon Prime', decimals: 18 },
      { address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', symbol: 'DEGEN', name: 'Degen', decimals: 18 },
      { address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', symbol: 'HIGHER', name: 'Higher', decimals: 18 },
      { address: '0x532f27101965dd16442e59d40670faf5ebb142e4', symbol: 'BRETT', name: 'Brett', decimals: 18 },
      { address: '0x768be13e1680b5ebe0024c42c896e3db59ec0149', symbol: 'MOCHI', name: 'Mochi', decimals: 18 },
      { address: '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4', symbol: 'TOSHI', name: 'Toshi', decimals: 18 },
      { address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', symbol: 'rETH', name: 'Rocket Pool ETH', decimals: 18 },
      { address: '0xc5fecC3a29Fb57B5024eEc8a2239d4621e111CBE', symbol: '1INCH', name: '1INCH Token', decimals: 18 },
      { address: '0x9e1028F5F1D5eDE59748FFceE5532509976840E0', symbol: 'COMP', name: 'Compound', decimals: 18 },
      { address: '0x3992B27dA26848C2b19CeA6Fd25ad5568B68AB98', symbol: 'BASED', name: 'Based', decimals: 18 },
      { address: '0xba0Dda8762C24dA9487f5FA026a9B64b695A07Ea', symbol: 'OX', name: 'OX Coin', decimals: 18 },
    ];

    for (const token of popularTokens) {
      const address = token.address.toLowerCase();
      if (tokenMap.has(address)) continue;
      
      try {
        const balance = await this.getTokenBalance(address, userAddress);
        if (balance !== '0' && BigInt(balance) > 0n) {
          const balanceFormatted = ethers.formatUnits(balance, token.decimals);
          
          tokenMap.set(address, {
            address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            balance,
            balanceFormatted,
            valueUSD: 0,
            isDust: false,
          });
        }
      } catch (error) {
        // Skip failed tokens
      }
    }
  }

  // Add ETH balance
  private async addEthBalance(
    userAddress: string,
    tokenMap: Map<string, TokenInfo>
  ): Promise<void> {
    try {
      const ethBalance = await this.provider.getBalance(userAddress);
      if (ethBalance > 0n) {
        tokenMap.set('0x0000000000000000000000000000000000000000', {
          address: '0x0000000000000000000000000000000000000000',
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
          balance: ethBalance.toString(),
          balanceFormatted: ethers.formatEther(ethBalance),
          valueUSD: 0,
          isDust: false,
        });
      }
    } catch (error) {
      console.error('Error fetching ETH balance:', error);
    }
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
