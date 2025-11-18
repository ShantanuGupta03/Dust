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

  // Get token prices for multiple tokens
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

      // For Base network tokens, we'll use CoinGecko's Base token list
      const baseTokenIds = this.getBaseTokenIds();
      
      if (baseTokenIds.length > 0) {
        const ids = baseTokenIds.join(',');
        const response = await fetch(
          `${this.baseUrl}/simple/price?ids=${ids}&vs_currencies=usd,eth&x_cg_demo_api_key=${this.apiKey}`
        );
        const data = await response.json();

        // Map CoinGecko IDs to token addresses
        for (const [id, priceData] of Object.entries(data)) {
          const address = this.getTokenAddressFromId(id);
          if (address) {
            prices[address] = {
              usd: (priceData as any).usd,
              eth: (priceData as any).eth,
            };
          }
        }
      }

      // Cache the results
      this.cache.set(cacheKey, prices);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      return prices;
    } catch (error) {
      console.error('Error fetching token prices:', error);
      return {};
    }
  }

  // Update token values with current prices
  async updateTokenValues(tokens: TokenInfo[]): Promise<TokenInfo[]> {
    console.log('Updating token values for:', tokens.length, 'tokens');
    const tokenAddresses = tokens.map(token => token.address);
    const prices = await this.getTokenPrices(tokenAddresses);
    console.log('Prices received:', prices);

    // Get ETH price
    const ethPrice = await this.getETHPrice();

    return tokens.map(token => {
      const price = prices[token.address];
      if (price) {
        const balanceInETH = parseFloat(token.balanceFormatted) * price.eth;
        const valueUSD = balanceInETH * ethPrice;
        
        console.log(`Token ${token.symbol}: balance=${token.balanceFormatted}, price=${price.eth} ETH, value=${valueUSD} USD`);
        
        return {
          ...token,
          valueUSD,
        };
      }
      
      // For tokens without price data, estimate value as 0 or very low
      // This allows them to be filtered as dust tokens
      console.log(`No price found for token ${token.symbol} (${token.address}), setting value to 0`);
      return {
        ...token,
        valueUSD: 0, // Will be treated as dust if < $2
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
