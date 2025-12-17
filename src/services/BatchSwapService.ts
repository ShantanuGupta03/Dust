import { ethers } from "ethers";
import { TokenInfo, ConversionOption } from "../types/token";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const CHAIN_ID = 8453;

// 👉 Vercel proxy endpoints
const ZERO_X_PRICE_URL = "/api/0x-price";
const ZERO_X_QUOTE_URL = "/api/0x-quote";

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string = "https://mainnet.base.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  private getHeaders(): HeadersInit {
    return { accept: "application/json" };
  }

  async getPriceEstimate(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
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
    });

    const url = `${ZERO_X_PRICE_URL}?${params}`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) return null;

    const data = await res.json();

    return {
      buyAmount: data.buyAmount,
      estimatedGas: data.transaction?.gas ?? "200000",
      liquidityAvailable: data.liquidityAvailable,
    };
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

    const url = `${ZERO_X_QUOTE_URL}?${params}`;

    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    return res.json();
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
  ): Promise<{ canSwap: boolean; reason?: string }> {
    try {
      const estimate = await this.getPriceEstimate(fromToken, toToken, amountIn);
      
      if (!estimate) {
        return { canSwap: false, reason: 'No price estimate available' };
      }
      
      if (!estimate.liquidityAvailable) {
        return { canSwap: false, reason: 'No liquidity available' };
      }
      
      return { canSwap: true };
    } catch (error: any) {
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
        const approveTx = await tokenContract.approve(spender, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    // Execute swap
    const tx = await signer.sendTransaction({
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value || 0,
      gasLimit: quote.transaction.gas || 500000,
    });

    const receipt = await tx.wait();
    return receipt!.hash;
  }
}
