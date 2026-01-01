import { ethers } from "ethers";
import { TokenInfo, ConversionOption } from "../types/token";

// ERC20 ABI for approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// Base constants
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const CHAIN_ID = 8453;

// Use YOUR proxy endpoints (not 0x directly!)
const ZERO_X_PRICE_URL = "/api/0x-price";
const ZERO_X_QUOTE_URL = "/api/0x-quote";

// Types returned by your /api/0x-quote (quote + fee)
export type FeeBreakdown = {
  enabled: boolean;
  bps: number;
  recipient: string | null;
  token: string | null;
  usdNotional: number | null;
  feeAmount: string | null;
  tiers: any[];
};

export interface SwapQuote {
  liquidityAvailable: boolean;
  buyAmount: string;
  sellAmount: string;
  minBuyAmount?: string;
  issues?: {
    allowance?: null | { spender: string };
    balance?: any;
    simulationIncomplete?: boolean;
    invalidSourcesPassed?: string[];
  };
  transaction: {
    to: string;
    data: string;
    gas: string;   // string in API response
    value: string; // string in API response
  };
  tokenMetadata?: any;
}

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;

  constructor(rpcUrl: string = "https://mainnet.base.org") {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // No custom headers here — proxy handles 0x-version / api-key
  private getHeaders(): HeadersInit {
    return {
      accept: "application/json",
    };
  }

  private normalizeTo0xToken(addr: string): string {
    // your app uses zero-address for native ETH
    return addr === ethers.ZeroAddress ? WETH_ADDRESS : addr;
  }

  async getPriceEstimate(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
  ): Promise<{ buyAmount: string; estimatedGas: string; liquidityAvailable: boolean } | null> {
    try {
      const sellToken = this.normalizeTo0xToken(fromToken.address);
      const buyToken = this.normalizeTo0xToken(toToken.tokenAddress);

      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken,
        buyToken,
        sellAmount: amountIn.toString(),
      });

      const url = `${ZERO_X_PRICE_URL}?${params.toString()}`;

      const res = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Price estimate error:", res.status, errorText);
        return null;
      }

      const data = await res.json();

      return {
        buyAmount: data.buyAmount,
        estimatedGas: data.transaction?.gas ?? "200000",
        liquidityAvailable: !!data.liquidityAvailable,
      };
    } catch (error) {
      console.error("Error getting price estimate:", error);
      return null;
    }
  }

  async getSwapQuoteWithFee(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 1.0,
    takerAddress?: string,
    opts?: { disableFee?: boolean }
  ): Promise<{ quote: SwapQuote; fee: FeeBreakdown }> {
    const sellToken = this.normalizeTo0xToken(fromToken.address);
    const buyToken = this.normalizeTo0xToken(toToken.tokenAddress);

    // Keep your minimums if you want
    const minAmount = fromToken.decimals === 6 ? 1000n : 1000000000000n;
    const actualAmount = amountIn < minAmount ? minAmount : amountIn;

    if (!takerAddress) throw new Error("takerAddress is required for /quote");

    const params = new URLSearchParams({
      chainId: CHAIN_ID.toString(),
      sellToken,
      buyToken,
      sellAmount: actualAmount.toString(),
      slippagePercentage: (slippageTolerance / 100).toString(),
      taker: takerAddress,
      recipient: takerAddress,
    });

    // Note: txOrigin is optional and should be an Ethereum address if provided
    // We omit it since we don't have a specific dApp address
    // The wallet warning is addressed through UI disclosure instead

    if (opts?.disableFee) params.set("disableFee", "true");

    const response = await fetch(`${ZERO_X_QUOTE_URL}?${params.toString()}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    const raw = await response.text();

    if (!response.ok) {
      try {
        const j = JSON.parse(raw);
        throw new Error(`Failed to get quote: ${j.error || j.message || raw}`);
      } catch {
        throw new Error(`Failed to get quote: ${raw}`);
      }
    }

    const data = JSON.parse(raw);

    // The 0x API response structure may vary - handle both wrapped and direct responses
    let quote: SwapQuote;
    let fee: FeeBreakdown;

    if (data.quote) {
      // Response is wrapped: { quote: {...}, fee: {...} }
      quote = data.quote;
      fee = data.fee || { enabled: false, bps: 0, recipient: null, token: null, usdNotional: null, feeAmount: null, tiers: [] };
    } else {
      // Response is direct quote object
      quote = data;
      fee = { enabled: false, bps: 0, recipient: null, token: null, usdNotional: null, feeAmount: null, tiers: [] };
    }

    // Check for liquidity - if we have a buyAmount, there's liquidity
    // The liquidityAvailable field may not always be present in permit2 responses
    if (!quote?.buyAmount || BigInt(quote.buyAmount || '0') === 0n) {
      throw new Error(`No liquidity available for ${fromToken.symbol} -> ${toToken.symbol}`);
    }

    // Ensure liquidityAvailable is set for compatibility
    if (quote.liquidityAvailable === undefined) {
      quote.liquidityAvailable = true; // If we have buyAmount, liquidity exists
    }

    return { quote, fee };
  }

  // Convenience wrapper to match your old call sites
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 1.0,
    takerAddress?: string,
    opts?: { disableFee?: boolean }
  ): Promise<SwapQuote> {
    const { quote, fee } = await this.getSwapQuoteWithFee(
      fromToken,
      toToken,
      amountIn,
      slippageTolerance,
      takerAddress,
      opts
    );

    // optional logging (remove if noisy)
    console.log("Fee breakdown:", fee);

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
        symbol: "",
        name: "",
        decimals: 18,
        balance: amountIn.toString(),
        balanceFormatted: "",
        valueUSD: 0,
        isDust: false,
      };

      const toToken: ConversionOption = {
        tokenAddress: toTokenAddress,
        symbol: "",
        name: "",
        decimals: 18,
      };

      const estimate = await this.getPriceEstimate(fromToken, toToken, amountIn);
      return !!estimate?.liquidityAvailable;
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
      const estimate = await this.getPriceEstimate(fromToken, toToken, amountIn);

      if (!estimate) return { canSwap: false, reason: "No price estimate available" };
      if (!estimate.liquidityAvailable) return { canSwap: false, reason: "No liquidity available" };

      return { canSwap: true, estimatedOutput: estimate.buyAmount };
    } catch (error: any) {
      return { canSwap: false, reason: error?.message || "Unknown error" };
    }
  }

  async executeSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippage: number,
    signer: ethers.Signer,
    opts?: { disableFee?: boolean }
  ): Promise<string> {
    const userAddress = await signer.getAddress();

    // 1) Get quote (via proxy) — includes fee if enabled server-side
    const quote = await this.getSwapQuote(fromToken, toToken, amountIn, slippage, userAddress, opts);

    if (!quote?.transaction?.to || !quote?.transaction?.data) {
      throw new Error("Invalid quote: missing transaction fields");
    }

    // 2) Approve if needed (spender comes from quote issues)
    const spender = quote.issues?.allowance?.spender;

    const isNative =
      fromToken.address === ethers.ZeroAddress ||
      fromToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase(); // WETH usually needs approval; native ETH doesn't

    // Native ETH never needs ERC20 approval
    if (fromToken.address !== ethers.ZeroAddress && spender && !isNative) {
      const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);

      const allowance: bigint = await tokenContract.allowance(userAddress, spender);
      if (allowance < amountIn) {
        // Approve MaxUint256 for better UX - user only needs to approve once per token
        const approveTx = await tokenContract.approve(spender, ethers.MaxUint256);
        await approveTx.wait();
      }
    } else if (fromToken.address !== ethers.ZeroAddress && spender && fromToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
      // WETH *does* need approval; treat it like normal ERC20
      const tokenContract = new ethers.Contract(fromToken.address, ERC20_ABI, signer);
      const allowance: bigint = await tokenContract.allowance(userAddress, spender);
      if (allowance < amountIn) {
        // Approve MaxUint256 for better UX - user only needs to approve once per token
        const approveTx = await tokenContract.approve(spender, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    // 3) Execute swap transaction
    const gasLimit = quote.transaction.gas
      ? (BigInt(quote.transaction.gas) * 12n) / 10n // +20%
      : 500000n;

    const value = quote.transaction.value ? BigInt(quote.transaction.value) : 0n;

    const tx = await signer.sendTransaction({
      to: quote.transaction.to,
      data: quote.transaction.data,
      value,
      gasLimit,
    });

    const receipt = await tx.wait();
    
    // Check if transaction was reverted
    if (receipt?.status === 0) {
      throw new Error(`Transaction reverted. Hash: ${receipt.hash}. Check Basescan for details.`);
    }
    
    return receipt?.hash ?? tx.hash;
  }
}
