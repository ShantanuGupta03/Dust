import { ethers } from 'ethers';
import { TokenInfo, ConversionOption } from '../types/token';

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Base contract addresses
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// 0x API v2 base URL for Base network (UPDATED!)
const ZERO_X_API_BASE = 'https://api.0x.org/swap/allowance-holder';
const CHAIN_ID = 8453; // Base mainnet

export interface SwapQuote {
  blockNumber: string;
  buyAmount: string;
  buyToken: string;
  fees: {
    integratorFee: null;
    zeroExFee: {
      amount: string;
      token: string;
      type: string;
    };
    gasFee: null;
  };
  issues: {
    allowance: null | { spender: string };
    balance: null;
    simulationIncomplete: boolean;
    invalidSourcesPassed: string[];
  };
  liquidityAvailable: boolean;
  minBuyAmount: string;
  permit2: null;
  route: {
    fills: any[];
    tokens: any[];
  };
  sellAmount: string;
  sellToken: string;
  tokenMetadata: {
    buyToken: any;
    sellToken: any;
  };
  totalNetworkFee: string;
  transaction: {
    to: string;
    data: string;
    gas: string;
    gasPrice: string;
    value: string;
  };
  zid: string;
}

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;
  private apiKey: string = ''; // 0x API key (optional but recommended)

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Load API key from environment variable
    this.apiKey = import.meta.env.VITE_0X_API_KEY || '';
    
    if (this.apiKey) {
      console.log('✅ 0x API key loaded');
    } else {
      console.warn('⚠️ No 0x API key - you may hit rate limits');
    }
  }

  // Set API key if you have one (improves rate limits)
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Get headers for 0x API v2
// Get headers for 0x API v2
private getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "0x-version": "v2",          // ✅ required for v2
    "accept": "application/json",
  };

  if (this.apiKey && this.apiKey.trim() !== "") {
    headers["0x-api-key"] = this.apiKey;
  }

  return headers;
}


  // Check if a token has liquidity using 0x API v2 price endpoint
  async checkTokenLiquidity(tokenAddress: string): Promise<boolean> {
    try {
      // Native ETH and stablecoins always have liquidity
      if (
        tokenAddress === '0x0000000000000000000000000000000000000000' ||
        tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase() ||
        tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()
      ) {
        return true;
      }

      // Try to get a price quote - if successful, liquidity exists
      const sellToken = tokenAddress;
      const buyToken = USDC_ADDRESS;
      const sellAmount = '1000000000000000000'; // 1 token with 18 decimals

      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken: sellToken,
        buyToken: buyToken,
        sellAmount: sellAmount,
      });

      const url = `${ZERO_X_API_BASE}/swap/allowance-holder/price?${params}`;
      
      const response = await fetch(url, { 
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.liquidityAvailable === true;
      }
      
      return false;
    } catch (error) {
      console.log(`No liquidity found for ${tokenAddress}:`, error);
      return false;
    }
  }

  // Check liquidity with actual amount
  async checkTokenLiquidityWithAmount(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: bigint
  ): Promise<boolean> {
    try {
      // Normalize addresses
      const sellToken = tokenInAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS // Use WETH for native ETH
        : tokenInAddress;

      const buyToken = tokenOutAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : tokenOutAddress;

      // Ensure minimum amount
      const minAmount = 1000000n; // 0.001 USDC or equivalent
      const testAmount = amountIn >= minAmount ? amountIn : minAmount;

      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken: sellToken,
        buyToken: buyToken,
        sellAmount: testAmount.toString(),
      });

      const url = `${ZERO_X_API_BASE}/swap/allowance-holder/price?${params}`;
      
      console.log(`Checking liquidity: ${sellToken} -> ${buyToken}, amount: ${testAmount.toString()}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        const hasLiquidity = data.liquidityAvailable === true;
        console.log(`✅ Liquidity check: ${hasLiquidity ? 'Available' : 'Not available'}`);
        return hasLiquidity;
      }
      
      console.log(`❌ No liquidity found for ${sellToken} -> ${buyToken}`);
      return false;
    } catch (error) {
      console.error(`Error checking liquidity for ${tokenInAddress}:`, error);
      return false;
    }
  }

  // Get swap quote from 0x API v2
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 1.0,
    takerAddress?: string
  ): Promise<SwapQuote> {
    try {
      const sellToken = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : fromToken.address;
  
      const buyToken = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : toToken.tokenAddress;
  
      const minAmount = fromToken.decimals === 6 ? 1000n : 1000000000000n;
      const actualAmount = amountIn < minAmount ? minAmount : amountIn;
  
      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken: sellToken,
        buyToken: buyToken,
        sellAmount: actualAmount.toString(),
        slippagePercentage: (slippageTolerance / 100).toString(),
      });
  
      if (takerAddress) {
        params.append('taker', takerAddress);
      }
  
      // Use allowance-holder/quote for v2 API
      const url = `${ZERO_X_API_BASE}/swap/allowance-holder/quote?${params}`;
  
      console.log(`Getting swap quote: ${fromToken.symbol} -> ${toToken.symbol}`);
      console.log(`URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('0x API error response:', {
          status: response.status,
          error: errorData,
          url: url
        });
        
        throw new Error(`Failed to get quote: ${errorData.reason || errorData.message || response.statusText}`);
      }
  
      const quote = await response.json();
      
      if (!quote.liquidityAvailable) {
        throw new Error(`No liquidity available for ${fromToken.symbol} -> ${toToken.symbol}`);
      }
  
      console.log(`✅ Quote received`);
      return quote;
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw error;
    }
  }

  // Get price estimate (no taker address needed)
  async getPriceEstimate(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
  ): Promise<{ buyAmount: string; price: string; estimatedGas: string; liquidityAvailable: boolean } | null> {
    try {
      const sellToken = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : fromToken.address;
  
      const buyToken = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : toToken.tokenAddress;
  
      const minAmount = fromToken.decimals === 6 ? 1000n : 1000000000000n;
      const actualAmount = amountIn < minAmount ? minAmount : amountIn;
  
      const params = new URLSearchParams({
        chainId: CHAIN_ID.toString(),
        sellToken: sellToken,
        buyToken: buyToken,
        sellAmount: actualAmount.toString(),
      });
  
      // Use allowance-holder/price for v2 API
      const url = `${ZERO_X_API_BASE}/swap/allowance-holder/price?${params}`;
      
      console.log(`Getting price estimate: ${fromToken.symbol} -> ${toToken.symbol}`);
      console.log(`URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const responseText = await response.text();
      console.log('Response:', response.status, responseText.substring(0, 200));
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { rawError: responseText };
        }
        
        console.error('API Error:', {
          status: response.status,
          error: errorData,
          url: url
        });
        
        return null;
      }
  
      const data = JSON.parse(responseText);
      console.log(`✅ Price estimate received:`, data);
      
      return {
        buyAmount: data.buyAmount,
        price: data.buyAmount && data.sellAmount 
          ? (BigInt(data.buyAmount) / BigInt(data.sellAmount)).toString()
          : '0',
        estimatedGas: data.transaction?.gas || data.totalNetworkFee || '200000',
        liquidityAvailable: data.liquidityAvailable,
      };
    } catch (error) {
      console.error('Error getting price estimate:', error);
      return null;
    }
  }

  // Approve token for 0x exchange proxy
  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    signer: ethers.Signer,
    amount: bigint
  ): Promise<string | null> {
    try {
      if (tokenAddress === '0x0000000000000000000000000000000000000000' ||
          tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        return null; // ETH/WETH doesn't need approval in most cases
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // Check current allowance
      const allowance = await tokenContract.allowance(userAddress, spenderAddress);
      
      if (allowance >= amount) {
        console.log(`Token ${tokenAddress} already approved for ${spenderAddress}`);
        return null;
      }

      // Approve max amount for convenience
      console.log(`Approving token ${tokenAddress} for ${spenderAddress}...`);
      const approveTx = await tokenContract.approve(spenderAddress, ethers.MaxUint256);
      await approveTx.wait();
      console.log(`Token approved: ${approveTx.hash}`);
      return approveTx.hash;
    } catch (error) {
      console.error(`Error approving token ${tokenAddress}:`, error);
      throw error;
    }
  }

  // Execute a single swap using 0x API v2
  async executeSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    recipient: string,
    signer: ethers.Signer,
    slippageTolerance: number = 1.0
  ): Promise<string> {
    try {
      console.log(`Executing swap: ${fromToken.symbol} -> ${toToken.symbol}`);
      console.log(`Amount: ${ethers.formatUnits(amountIn, fromToken.decimals)} ${fromToken.symbol}`);

      // Ensure minimum amount
      const minAmount = fromToken.decimals === 6 ? 1000n : 1000000000000n;
      const actualAmount = amountIn < minAmount ? minAmount : amountIn;
      
      if (actualAmount !== amountIn) {
        console.log(`⚠️ Amount too small, using minimum: ${ethers.formatUnits(actualAmount, fromToken.decimals)} ${fromToken.symbol}`);
      }

      // Get quote with taker address
      const quote = await this.getSwapQuote(
        fromToken,
        toToken,
        actualAmount,
        slippageTolerance,
        recipient
      );

      // Approve token if needed (check if approval is required)
      if (quote.issues?.allowance?.spender) {
        await this.approveToken(
          fromToken.address,
          quote.issues.allowance.spender,
          signer,
          actualAmount
        );
      }

      // Prepare transaction from quote
      const txRequest: ethers.TransactionRequest = {
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value),
        gasLimit: BigInt(quote.transaction.gas) * 12n / 10n, // Add 20% buffer
      };

      console.log('Sending swap transaction...');
      console.log('Transaction details:', {
        to: quote.transaction.to,
        value: quote.transaction.value,
        gasLimit: txRequest.gasLimit?.toString(),
      });
      
      const tx = await signer.sendTransaction(txRequest);
      console.log(`Swap transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`Swap confirmed: ${receipt?.hash}`);

      return receipt?.hash || tx.hash;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw new Error(`Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Execute batch swaps
  async executeBatchSwaps(
    swaps: Array<{
      fromToken: TokenInfo;
      toToken: ConversionOption;
      amountIn: bigint;
    }>,
    recipient: string,
    signer: ethers.Signer,
    slippageTolerance: number = 1.0
  ): Promise<{ swapTxHashes: string[]; approveTxHashes: string[] }> {
    const swapTxHashes: string[] = [];
    const approveTxHashes: string[] = [];
    const failedSwaps: string[] = [];

    console.log(`Executing ${swaps.length} swaps via 0x API v2...`);

    // Execute swaps sequentially
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      
      try {
        console.log(`\n[${i + 1}/${swaps.length}] Swapping ${swap.fromToken.symbol} -> ${swap.toToken.symbol}`);
        
        // Get fresh quote
        const quote = await this.getSwapQuote(
          swap.fromToken,
          swap.toToken,
          swap.amountIn,
          slippageTolerance,
          recipient
        );

        // Approve if needed
        if (quote.issues?.allowance?.spender) {
          const approveHash = await this.approveToken(
            swap.fromToken.address,
            quote.issues.allowance.spender,
            signer,
            swap.amountIn
          );
          if (approveHash) {
            approveTxHashes.push(approveHash);
          }
        }

        // Execute swap
        const txRequest: ethers.TransactionRequest = {
          to: quote.transaction.to,
          data: quote.transaction.data,
          value: BigInt(quote.transaction.value),
          gasLimit: BigInt(quote.transaction.gas) * 12n / 10n,
        };

        const tx = await signer.sendTransaction(txRequest);
        console.log(`Transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (receipt?.hash) {
          swapTxHashes.push(receipt.hash);
          console.log(`✅ Swap ${i + 1} completed: ${receipt.hash}`);
        }

        // Small delay between swaps
        if (i < swaps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error executing swap ${i + 1} (${swap.fromToken.symbol}):`, error);
        failedSwaps.push(swap.fromToken.symbol);
        // Continue with other swaps
      }
    }

    if (failedSwaps.length > 0) {
      console.log(`\n⚠️ Failed swaps: ${failedSwaps.join(', ')}`);
    }

    console.log(`\n✅ Completed ${swapTxHashes.length}/${swaps.length} swaps`);
    return { swapTxHashes, approveTxHashes };
  }

  // Helper to check if swap is possible
  async canSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint
  ): Promise<{ canSwap: boolean; reason?: string; estimatedOutput?: string }> {
    try {
      console.log(`Checking if swap is possible: ${fromToken.symbol} -> ${toToken.symbol}`);
      console.log(`From token address: ${fromToken.address}`);
      console.log(`To token address: ${toToken.tokenAddress}`);
      console.log(`Amount in: ${amountIn.toString()} (${ethers.formatUnits(amountIn, fromToken.decimals)} ${fromToken.symbol})`);

      // Ensure minimum amount
      const minAmount = fromToken.decimals === 6 ? 1000n : 1000000000000n;
      const actualAmount = amountIn < minAmount ? minAmount : amountIn;
      
      if (actualAmount !== amountIn) {
        console.log(`⚠️ Using minimum amount: ${ethers.formatUnits(actualAmount, fromToken.decimals)} ${fromToken.symbol}`);
      }

      const estimate = await this.getPriceEstimate(fromToken, toToken, actualAmount);
      
      if (!estimate || !estimate.liquidityAvailable) {
        console.log(`❌ No liquidity available`);
        return { 
          canSwap: false, 
          reason: 'No liquidity or route available for this token pair. The amount may be too small or the pair may not have sufficient liquidity on Base network.' 
        };
      }

      console.log(`✅ Swap is possible. Estimated output: ${estimate.buyAmount}`);
      return {
        canSwap: true,
        estimatedOutput: estimate.buyAmount,
      };
    } catch (error) {
      console.error('Error in canSwap:', error);
      return {
        canSwap: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Test method to verify 0x API v2 is working
  async testSwap(
    sellTokenAddress: string,
    buyTokenAddress: string,
    sellAmount: string
  ): Promise<any> {
    const sellToken = sellTokenAddress === '0x0000000000000000000000000000000000000000' 
      ? WETH_ADDRESS
      : sellTokenAddress;
    const buyToken = buyTokenAddress === '0x0000000000000000000000000000000000000000'
      ? WETH_ADDRESS
      : buyTokenAddress;

    const params = new URLSearchParams({
      chainId: CHAIN_ID.toString(),
      sellToken: sellToken,
      buyToken: buyToken,
      sellAmount: sellAmount,
    });

    const url = `${ZERO_X_API_BASE}/swap/allowance-holder/price?${params}`;
    console.log('Testing 0x API v2 with URL:', url);
    
    const response = await fetch(url, { 
      method: 'GET',
      headers: this.getHeaders(),
    });
    const data = await response.json();
    
    console.log('0x API v2 Response:', {
      status: response.status,
      ok: response.ok,
      data: data
    });
    
    return { response, data };
  }
}