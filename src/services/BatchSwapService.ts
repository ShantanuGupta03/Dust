import { ethers } from "ethers";
import { TokenInfo, ConversionOption } from "../types/token";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const CHAIN_ID = 8453;

// ✅ Use YOUR proxy endpoints (not 0x API directly!)
const ZERO_X_PRICE_URL = "/api/0x-price";
const ZERO_X_QUOTE_URL = "/api/0x-quote";

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;
  private apiKey: string = '';

  constructor(rpcUrl: string = "https://mainnet.base.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.apiKey = import.meta.env.VITE_0X_API_KEY || '';
    
    if (this.apiKey) {
      console.log('✅ 0x API key loaded');
    }
  }

  // Simple headers - no 0x-version or 0x-api-key (handled by proxy!)
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  async getPriceEstimate(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
  ) {
    try {
      const sellToken =
        fromToken.address === ethers.ZeroAddress
          ? WETH_ADDRESS
          : fromToken.address;

      const buyToken =
        toToken.tokenAddress === ethers.ZeroAddress
          ? WETH_ADDRESS
          : toToken.tokenAddress;

      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: amountIn.toString(),
      });

      // ✅ Use proxy URL (not direct 0x API)
      const url = `${ZERO_X_PRICE_URL}?${params}`;
      
      console.log('Getting price estimate:', fromToken.symbol, '->', toToken.symbol);
      console.log('URL:', url);

      const res = await fetch(url, { 
        method: 'GET',
        headers: this.getHeaders() 
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Price estimate error:', res.status, errorText);
        return null;
      }

      const data = await res.json();
      console.log('✅ Price estimate received:', data);

      return {
        buyAmount: data.buyAmount,
        estimatedGas: data.transaction?.gas ?? "200000",
        liquidityAvailable: data.liquidityAvailable,
      };
    } catch (error) {
      console.error('Error getting price estimate:', error);
      return null;
    }
  }

  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippage: number,
    taker: string
  ) {
    const sellToken =
      fromToken.address === ethers.ZeroAddress
        ? WETH_ADDRESS
        : fromToken.address;

    const buyToken =
      toToken.tokenAddress === ethers.ZeroAddress
        ? WETH_ADDRESS
        : toToken.tokenAddress;

    const params = new URLSearchParams({
      chainId: CHAIN_ID.toString(),
      sellToken,
      buyToken,
      sellAmount: amountIn.toString(),
      slippagePercentage: (slippage / 100).toString(),
      taker,
    });

    // ✅ Use proxy URL
    const url = `${ZERO_X_QUOTE_URL}?${params}`;
    
    console.log('Getting swap quote...');
    console.log('URL:', url);

    const res = await fetch(url, { 
      method: 'GET',
      headers: this.getHeaders() 
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.error('Quote error:', res.status, err);
      throw new Error(err);
    }

    const quote = await res.json();
    console.log('✅ Swap quote received');
    return quote;
  }

  async checkTokenLiquidityWithAmount(
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: bigint
  ): Promise<boolean> {
    try {
      const fromToken: TokenInfo = {
        address: fromTokenAddress,
        symbol: '',
        name: '',
        decimals: 18,
        balance: amountIn.toString(),
        balanceFormatted: '',
        valueUSD: 0,
        isDust: false,
      };
      
      const toToken: ConversionOption = {
        tokenAddress: toTokenAddress,
        symbol: '',
        name: '',
      };

      const estimate = await this.getPriceEstimate(fromToken, toToken, amountIn);
      return estimate !== null && estimate.liquidityAvailable;
    } catch {
      return false;
    }
  }

  async canSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
  ): Promise<{ canSwap: boolean; reason?: string; estimatedOutput?: string }> {
    try {
      console.log('Checking if swap is possible:', fromToken.symbol, '->', toToken.symbol);
      console.log('Amount:', amountIn.toString());
      
      const estimate = await this.getPriceEstimate(fromToken, toToken, amountIn);
      
      if (!estimate) {
        return { canSwap: false, reason: 'No price estimate available' };
      }
      
      if (!estimate.liquidityAvailable) {
        return { canSwap: false, reason: 'No liquidity available' };
      }
      
      console.log('✅ Swap is possible. Output:', estimate.buyAmount);
      return { 
        canSwap: true,
        estimatedOutput: estimate.buyAmount,
      };
    } catch (error: any) {
      console.error('Error in canSwap:', error);
      return { canSwap: false, reason: error.message || 'Unknown error' };
    }
  }

  async executeSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippage: number,
    signer: ethers.Signer
  ): Promise<string> {
    const userAddress = await signer.getAddress();
    
    console.log('Executing swap:', fromToken.symbol, '->', toToken.symbol);
    
    // Get quote
    const quote = await this.getSwapQuote(fromToken, toToken, amountIn, slippage, userAddress);
    
    if (!quote || !quote.transaction) {
      throw new Error('Failed to get swap quote');
    }

    // Check if approval is needed
    if (fromToken.address !== ethers.ZeroAddress) {
      const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
      const spender = quote.transaction.to;
      const allowance = await tokenContract.allowance(userAddress, spender);
      
      if (allowance < amountIn) {
        console.log('Approving token...');
        const approveTx = await tokenContract.approve(spender, ethers.MaxUint256);
        await approveTx.wait();
        console.log('✅ Token approved');
      }
    }

    // Execute swap
    console.log('Sending swap transaction...');
    const tx = await signer.sendTransaction({
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value || 0,
      gasLimit: quote.transaction.gas || 500000,
    });

    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Swap completed:', receipt!.hash);
    
    return receipt!.hash;
  }
}