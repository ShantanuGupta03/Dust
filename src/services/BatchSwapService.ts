import { ethers } from 'ethers';
import { TokenInfo, ConversionOption } from '../types/token';

// 1inch Aggregation Router V5 ABI (simplified)
const AGGREGATION_ROUTER_ABI = [
  'function swap((address caller, address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) params, bytes data) external payable returns (uint256 returnAmount)',
  'function unoswap(address srcToken, uint256 amount, uint256 minReturn, bytes32[] calldata pools) external payable returns (uint256 returnAmount)',
];

// 1inch Aggregation Router V5 address on Base
const AGGREGATION_ROUTER_ADDRESS = '0x1111111254EEB25477B68fb85Ed929f73A960582';

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

// 1inch API base URL (using v5.2 which is more public-friendly)
const ONEINCH_API_URL = 'https://api.1inch.io/v5.2/8453'; // Base chain ID: 8453

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;
  private routerContract: ethers.Contract;

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.routerContract = new ethers.Contract(
      AGGREGATION_ROUTER_ADDRESS,
      AGGREGATION_ROUTER_ABI,
      this.provider
    );
  }

  // Batch approve multiple tokens at once
  async batchApproveTokens(
    tokenAddresses: string[],
    amounts: bigint[],
    signer: ethers.Signer
  ): Promise<string[]> {
    const txHashes: string[] = [];
    const userAddress = await signer.getAddress();

    console.log(`Batch approving ${tokenAddresses.length} tokens...`);

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i];
      const amount = amounts[i];

      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        continue; // ETH doesn't need approval
      }

      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // Check current allowance
        const allowance = await tokenContract.allowance(userAddress, AGGREGATION_ROUTER_ADDRESS);
        
        if (allowance >= amount) {
          console.log(`Token ${tokenAddress} already approved`);
          continue;
        }

        // Approve token spending
        console.log(`Approving token ${tokenAddress}...`);
        const approveTx = await tokenContract.approve(AGGREGATION_ROUTER_ADDRESS, amount);
        await approveTx.wait();
        console.log(`Token approved: ${approveTx.hash}`);
        txHashes.push(approveTx.hash);
      } catch (error) {
        console.error(`Error approving token ${tokenAddress}:`, error);
        // Continue with other tokens
      }
    }

    return txHashes;
  }

  // Check and approve token spending
  async approveToken(
    tokenAddress: string,
    signer: ethers.Signer,
    amount: bigint
  ): Promise<string | null> {
    try {
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return null; // ETH doesn't need approval
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const userAddress = await signer.getAddress();
      
      // Check current allowance
      const allowance = await tokenContract.allowance(userAddress, AGGREGATION_ROUTER_ADDRESS);
      
      if (allowance >= amount) {
        console.log(`Token ${tokenAddress} already approved`);
        return null; // Already approved
      }

      // Approve token spending
      console.log(`Approving token ${tokenAddress}...`);
      const approveTx = await tokenContract.approve(AGGREGATION_ROUTER_ADDRESS, amount);
      await approveTx.wait();
      console.log(`Token approved: ${approveTx.hash}`);
      return approveTx.hash;
    } catch (error) {
      console.error(`Error approving token ${tokenAddress}:`, error);
      throw error;
    }
  }

  // Get swap quote from 1inch API
  async getSwapQuoteFrom1inch(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 0.5
  ): Promise<{ tx: any; toTokenAmount: bigint }> {
    try {
      const srcToken = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' // 1inch uses this for native ETH
        : fromToken.address;
      
      const dstToken = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        : toToken.tokenAddress;

      const amount = amountIn.toString();
      const slippage = slippageTolerance;

      // Call 1inch API to get swap quote and transaction data
      const url = `${ONEINCH_API_URL}/swap?src=${srcToken}&dst=${dstToken}&amount=${amount}&from=${AGGREGATION_ROUTER_ADDRESS}&slippage=${slippage}`;
      
      console.log('Fetching quote from 1inch:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`1inch API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.tx || !data.toTokenAmount) {
        throw new Error('Invalid response from 1inch API');
      }

      console.log('1inch quote received:', {
        fromAmount: amount,
        toAmount: data.toTokenAmount,
        estimatedGas: data.estimatedGas,
      });

      return {
        tx: data.tx,
        toTokenAmount: BigInt(data.toTokenAmount),
      };
    } catch (error) {
      console.error('Error getting 1inch quote:', error);
      throw new Error(`Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Execute a single token swap using 1inch
  async executeSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    recipient: string,
    signer: ethers.Signer,
    slippageTolerance: number = 0.5
  ): Promise<string> {
    try {
      // Get swap quote from 1inch
      const quote = await this.getSwapQuoteFrom1inch(
        fromToken,
        toToken,
        amountIn,
        slippageTolerance
      );

      // Approve token if needed
      if (fromToken.address !== '0x0000000000000000000000000000000000000000') {
        await this.approveToken(fromToken.address, signer, amountIn);
      }

      // Prepare transaction from 1inch response
      const txData = quote.tx;
      
      // Execute swap
      console.log('Executing swap via 1inch...');
      
      const txParams: any = {
        to: txData.to,
        data: txData.data,
      };

      // Add gas parameters if provided
      if (txData.gas) {
        txParams.gasLimit = BigInt(txData.gas);
      }
      if (txData.gasPrice) {
        txParams.gasPrice = BigInt(txData.gasPrice);
      } else if (txData.maxFeePerGas) {
        txParams.maxFeePerGas = BigInt(txData.maxFeePerGas);
        txParams.maxPriorityFeePerGas = BigInt(txData.maxPriorityFeePerGas || txData.maxFeePerGas);
      }

      // Add value for native ETH swaps
      if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        txParams.value = amountIn;
      }

      const tx = await signer.sendTransaction(txParams);

      console.log('Swap transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('Swap confirmed:', receipt.transactionHash);
      
      return receipt.transactionHash;
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
    slippageTolerance: number = 0.5
  ): Promise<string[]> {
    const txHashes: string[] = [];
    
    console.log(`Executing ${swaps.length} swaps in batch...`);

    // First, batch approve all tokens
    const tokenAddresses = swaps
      .map(s => s.fromToken.address)
      .filter(addr => addr !== '0x0000000000000000000000000000000000000000');
    const amounts = swaps
      .map((s, i) => tokenAddresses.includes(s.fromToken.address) ? s.amountIn : BigInt(0))
      .filter(amt => amt > 0);

    if (tokenAddresses.length > 0) {
      console.log('Batch approving tokens...');
      const approveTxHashes = await this.batchApproveTokens(tokenAddresses, amounts, signer);
      txHashes.push(...approveTxHashes);
    }

    // Execute swaps sequentially
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      try {
        console.log(`Executing swap ${i + 1}/${swaps.length}: ${swap.fromToken.symbol} -> ${swap.toToken.symbol}`);
        
        const txHash = await this.executeSwap(
          swap.fromToken,
          swap.toToken,
          swap.amountIn,
          recipient,
          signer,
          slippageTolerance
        );
        
        txHashes.push(txHash);
        
        // Small delay between swaps to avoid nonce issues
        if (i < swaps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error executing swap ${i + 1}:`, error);
        // Continue with other swaps even if one fails
      }
    }

    return txHashes;
  }

  // Get quote for swap using 1inch API
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 0.5
  ): Promise<{ amountOut: bigint; amountOutMinimum: bigint }> {
    try {
      const quote = await this.getSwapQuoteFrom1inch(
        fromToken,
        toToken,
        amountIn,
        slippageTolerance
      );

      const amountOut = quote.toTokenAmount;
      const amountOutMinimum = this.calculateAmountOutMinimum(amountOut, slippageTolerance);
      
      return { amountOut, amountOutMinimum };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      // Fallback to conservative estimate
      const amountOut = amountIn; // Very conservative fallback
      const amountOutMinimum = this.calculateAmountOutMinimum(amountOut, slippageTolerance);
      return { amountOut, amountOutMinimum };
    }
  }

  // Get minimum amount out with slippage
  calculateAmountOutMinimum(amountOut: bigint, slippageTolerance: number): bigint {
    const slippageBps = Math.floor(slippageTolerance * 100);
    return (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
  }
}