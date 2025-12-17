export class BasescanService {
    private apiKey: string;
    private baseUrl = 'https://api.basescan.org/api';
  
    constructor() {
      this.apiKey = import.meta.env.VITE_BASESCAN_API_KEY || '';
    }
  
    /**
     * Get all ERC20 token transfers for an address
     * This gives us all tokens the wallet has interacted with
     */
    async getAllTokenAddresses(address: string): Promise<string[]> {
      try {
        const response = await fetch(
          `${this.baseUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${this.apiKey}`
        );
  
        const data = await response.json();
  
        if (data.status !== '1') {
          console.error('Basescan API error:', data.message);
          return [];
        }
  
        // Get unique token addresses
        const uniqueAddresses = [...new Set(
          data.result.map((tx: any) => tx.contractAddress)
        )] as string[];
  
        return uniqueAddresses;
      } catch (error) {
        console.error('Error fetching token addresses from Basescan:', error);
        return [];
      }
    }
  }