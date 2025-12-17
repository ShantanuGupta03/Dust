import { TokenInfo } from '../types/token';

export interface PriceData {
  [tokenAddress: string]: {
    usd: number;
    eth: number;
  };
}

export class PriceService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private apiKey = 'CG-eUqdE477zX1Y45anFNV8ENZQ';
  private cache: Map<string, PriceData> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Get ETH price in USD
  async getETHPrice(): Promise<number> {
    try {
      console.log('Fetching ETH price from CoinGecko...');
      const response = await fetch(`${this.baseUrl}/simple/price?ids=ethereum&vs_currencies=usd&x_cg_demo_api_key=${this.apiKey}`);
      const data = await response.json();
      console.log('ETH price response:', data);
      return data.ethereum.usd;
    } catch (error) {
      console.error('Error fetching ETH price:', error);
      return 2000; // Fallback price
    }
  }

  // Get token prices for multiple tokens using contract addresses
  async getTokenPrices(tokenAddresses: string[]): Promise<PriceData> {
    const cacheKey = tokenAddresses.sort().join(',');
    const now = Date.now();

    // Check cache
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const prices: PriceData = {};
      
      // Get ETH price first
      const ethPrice = await this.getETHPrice();
      prices['0x0000000000000000000000000000000000000000'] = {
        usd: ethPrice,
        eth: 1,
      };

      // Remove ETH from the list
      const erc20Addresses = tokenAddresses.filter(addr => 
        addr !== '0x0000000000000000000000000000000000000000'
      );

      if (erc20Addresses.length > 0) {
        // Use CoinGecko's token price by contract address endpoint
        // Process in batches of 50 (CoinGecko limit)
        const batchSize = 50;
        for (let i = 0; i < erc20Addresses.length; i += batchSize) {
          const batch = erc20Addresses.slice(i, i + batchSize);
          const addressesParam = batch.join(',');
          
          try {
            // Try to get prices by contract address on Base network
            const response = await fetch(
              `${this.baseUrl}/simple/token_price/base?contract_addresses=${addressesParam}&vs_currencies=usd,eth&x_cg_demo_api_key=${this.apiKey}`
            );
            
            if (response.ok) {
              const data = await response.json();
              
              // CoinGecko returns lowercase addresses
              for (const [address, priceData] of Object.entries(data)) {
                const normalizedAddress = address.toLowerCase();
                prices[normalizedAddress] = {
                  usd: (priceData as any).usd || 0,
                  eth: (priceData as any).eth || 0,
                };
              }
            }
          } catch (error) {
            console.error(`Error fetching prices for batch ${i}:`, error);
          }
        }

        // Fallback: Try known token mappings for tokens not found
        const knownMappings = this.getKnownTokenMappings();
        for (const address of erc20Addresses) {
          const normalizedAddress = address.toLowerCase();
          if (!prices[normalizedAddress] && knownMappings[normalizedAddress]) {
            const tokenId = knownMappings[normalizedAddress];
            try {
              const response = await fetch(
                `${this.baseUrl}/simple/price?ids=${tokenId}&vs_currencies=usd,eth&x_cg_demo_api_key=${this.apiKey}`
              );
              if (response.ok) {
                const data = await response.json();
                if (data[tokenId]) {
                  prices[normalizedAddress] = {
                    usd: data[tokenId].usd || 0,
                    eth: data[tokenId].eth || 0,
                  };
                }
              }
            } catch (error) {
              console.error(`Error fetching price for ${tokenId}:`, error);
            }
          }
        }
      }

      // Cache the results
      this.cache.set(cacheKey, prices);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      console.log('Price data fetched:', prices);
      return prices;
    } catch (error) {
      console.error('Error fetching token prices:', error);
      return {};
    }
  }

  // Get known token mappings for fallback
  private getKnownTokenMappings(): { [address: string]: string } {
    return {
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'usd-coin', // USDC
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': 'tether', // USDT
      '0x4200000000000000000000000000000000000006': 'weth', // WETH
      '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'coinbase-wrapped-staked-eth', // cbETH
      '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'bridged-usdc', // USDbC
      '0x940181a94a35a4569e4529a3cdfb74e38fd98631': 'aerodrome-finance', // AERO
      '0x532f355c65c823e596d4f4ece16b9f4e55bd79ed': 'bald', // BALD
      '0x3c8b650257cfb5f272f799f5e2b4e65093a11a05': 'velodrome-finance', // VELO
      '0x4ed4e862860bed51a9570b96d89af5e1b0efefed': 'dai', // DAI
    };
  }

  // Update token values with current prices
  async updateTokenValues(tokens: TokenInfo[]): Promise<TokenInfo[]> {
    console.log('Updating token values for:', tokens.length, 'tokens');
    const tokenAddresses = tokens.map(token => token.address.toLowerCase());
    const prices = await this.getTokenPrices(tokenAddresses);
    console.log('Prices received:', prices);

    // Get ETH price
    const ethPrice = await this.getETHPrice();

    return tokens.map(token => {
      const normalizedAddress = token.address.toLowerCase();
      const price = prices[normalizedAddress];
      
      if (price && price.usd > 0) {
        // If we have USD price directly, use it
        const balance = parseFloat(token.balanceFormatted);
        const valueUSD = balance * price.usd;
        
        console.log(`Token ${token.symbol}: balance=${balance}, price=$${price.usd}, value=$${valueUSD}`);
        
        return {
          ...token,
          valueUSD,
        };
      } else if (price && price.eth > 0) {
        // If we have ETH price, convert to USD
        const balance = parseFloat(token.balanceFormatted);
        const valueUSD = balance * price.eth * ethPrice;
        
        console.log(`Token ${token.symbol}: balance=${balance}, price=${price.eth} ETH, value=$${valueUSD}`);
        
        return {
          ...token,
          valueUSD,
        };
      }
      
      // For tokens without price data, set value to 0
      // This allows them to be filtered as dust tokens (USD <= $10)
      console.log(`No price found for token ${token.symbol} (${normalizedAddress}), setting value to $0.00`);
      return {
        ...token,
        valueUSD: 0, // Will be treated as dust (USD <= $10)
      };
    });
  }

  // Get CoinGecko IDs for Base network tokens
  private getBaseTokenIds(): string[] {
    return [
      'ethereum', // ETH
      'usd-coin', // USDC
      'tether', // USDT
      'dai', // DAI
    ];
  }

  // Map CoinGecko ID to token address
  private getTokenAddressFromId(id: string): string | null {
    const mapping: { [key: string]: string } = {
      'ethereum': '0x0000000000000000000000000000000000000000',
      'usd-coin': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      'tether': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      'dai': '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    };
    return mapping[id] || null;
  }
}
