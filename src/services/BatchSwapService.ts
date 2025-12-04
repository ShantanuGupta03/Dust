import { ethers } from 'ethers';
import { TokenInfo, ConversionOption } from '../types/token';

// Uniswap V3 SwapRouter02 ABI
const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)',
];

// Uniswap V3 QuoterV2 ABI for getting quotes
const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
];

// Uniswap V3 addresses on Base
const SWAP_ROUTER_ADDRESS = '0x2626664c2603336E57B271c5C0b26F421741e481'; // SwapRouter02
const QUOTER_ADDRESS = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a'; // QuoterV2
const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'; // WETH on Base

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

// WETH ABI for wrapping/unwrapping
const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256) external',
  'function balanceOf(address owner) view returns (uint256)',
];

// Common fee tiers for Uniswap V3
const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

export class BatchSwapService {
  private provider: ethers.JsonRpcProvider;
  private routerContract: ethers.Contract;
  private quoterContract: ethers.Contract;

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.routerContract = new ethers.Contract(
      SWAP_ROUTER_ADDRESS,
      SWAP_ROUTER_ABI,
      this.provider
    );
    this.quoterContract = new ethers.Contract(
      QUOTER_ADDRESS,
      QUOTER_ABI,
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
        const allowance = await tokenContract.allowance(userAddress, SWAP_ROUTER_ADDRESS);
        
        if (allowance >= amount) {
          console.log(`Token ${tokenAddress} already approved`);
          continue;
        }

        // Approve token spending
        console.log(`Approving token ${tokenAddress}...`);
        const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amount);
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
      const allowance = await tokenContract.allowance(userAddress, SWAP_ROUTER_ADDRESS);
      
      if (allowance >= amount) {
        console.log(`Token ${tokenAddress} already approved`);
        return null; // Already approved
      }

      // Approve token spending
      console.log(`Approving token ${tokenAddress}...`);
      const approveTx = await tokenContract.approve(SWAP_ROUTER_ADDRESS, amount);
      await approveTx.wait();
      console.log(`Token approved: ${approveTx.hash}`);
      return approveTx.hash;
    } catch (error) {
      console.error(`Error approving token ${tokenAddress}:`, error);
      throw error;
    }
  }

  // Check if a token has liquidity (pool exists) against common pairs
  async checkTokenLiquidity(tokenAddress: string): Promise<boolean> {
    try {
      // Skip check for native ETH and WETH
      if (tokenAddress === '0x0000000000000000000000000000000000000000' || 
          tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        return true;
      }

      const tokenIn = tokenAddress;
      const testAmount = ethers.parseUnits('1', 18); // Test with 1 token (assuming 18 decimals)
      
      // Check against USDC (most common pair)
      const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      const hasUsdcPool = await this.findBestFeeTier(tokenIn, usdcAddress, testAmount);
      if (hasUsdcPool) {
        return true;
      }

      // Check against WETH (second most common)
      const hasWethPool = await this.findBestFeeTier(tokenIn, WETH_ADDRESS, testAmount);
      if (hasWethPool) {
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking liquidity for ${tokenAddress}:`, error);
      return false;
    }
  }

  // Find the best fee tier for a token pair
  async findBestFeeTier(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ fee: number; amountOut: bigint } | null> {
    // Try each fee tier
    for (const fee of FEE_TIERS) {
      try {
        const result = await this.quoterContract.quoteExactInputSingle.staticCall({
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0,
        });
        
        const amountOut = result[0];
        if (amountOut > 0n) {
          return { fee, amountOut };
        }
      } catch (error) {
        // Pool doesn't exist for this fee tier, try next
        continue;
      }
    }
    
    // If direct swap doesn't work, try routing through WETH
    if (tokenIn !== WETH_ADDRESS && tokenOut !== WETH_ADDRESS) {
      // Try tokenIn -> WETH -> tokenOut
      for (const fee1 of FEE_TIERS) {
        for (const fee2 of FEE_TIERS) {
          try {
            // First leg: tokenIn -> WETH
            const result1 = await this.quoterContract.quoteExactInputSingle.staticCall({
              tokenIn,
              tokenOut: WETH_ADDRESS,
              amountIn,
              fee: fee1,
              sqrtPriceLimitX96: 0,
            });
            const wethAmount = result1[0];
            
            if (wethAmount === 0n) continue;
            
            // Second leg: WETH -> tokenOut
            const result2 = await this.quoterContract.quoteExactInputSingle.staticCall({
              tokenIn: WETH_ADDRESS,
              tokenOut,
              amountIn: wethAmount,
              fee: fee2,
              sqrtPriceLimitX96: 0,
            });
            const amountOut = result2[0];
            
            if (amountOut > 0n) {
              // Return the first fee tier, we'll handle routing in executeSwap
              return { fee: fee1, amountOut };
            }
          } catch (error) {
            continue;
          }
        }
      }
    }
    
    return null;
  }

  // Get swap quote using Uniswap V3
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 0.5
  ): Promise<{ amountOut: bigint; amountOutMinimum: bigint; fee: number }> {
    try {
      const tokenIn = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : fromToken.address;
      
      const tokenOut = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : toToken.tokenAddress;

      // Find best fee tier
      const bestRoute = await this.findBestFeeTier(tokenIn, tokenOut, amountIn);
      
      if (!bestRoute) {
        throw new Error('No liquidity pool found for this token pair');
      }

      const { amountOut, fee } = bestRoute;
      const slippageBps = Math.floor(slippageTolerance * 100);
      const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

      return { amountOut, amountOutMinimum, fee };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      throw new Error(`Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Execute a single token swap using Uniswap V3
  async executeSwap(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    recipient: string,
    signer: ethers.Signer,
    slippageTolerance: number = 0.5,
    skipApproval: boolean = false
  ): Promise<string> {
    try {
      // Get quote
      const quote = await this.getSwapQuote(fromToken, toToken, amountIn, slippageTolerance);
      
      const tokenIn = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : fromToken.address;
      
      const tokenOut = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : toToken.tokenAddress;

      // Handle native ETH: wrap it first
      let actualAmountIn = amountIn;
      if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        // Wrap ETH to WETH
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        console.log('Wrapping ETH to WETH...');
        const wrapTx = await wethContract.deposit({ value: amountIn });
        await wrapTx.wait();
        console.log('ETH wrapped:', wrapTx.hash);
      } else if (!skipApproval) {
        // Approve token if needed
        await this.approveToken(tokenIn, signer, amountIn);
      }

      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      // Execute swap
      console.log('Executing swap via Uniswap V3...');
      const routerWithSigner = this.routerContract.connect(signer);
      
      const swapParams = {
        tokenIn,
        tokenOut,
        fee: quote.fee,
        recipient,
        deadline,
        amountIn,
        amountOutMinimum: quote.amountOutMinimum,
        sqrtPriceLimitX96: 0,
      };

      // For native ETH swaps, we need to send ETH value
      const txOptions: any = {};
      if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        // We already wrapped ETH, so no value needed
        txOptions.value = 0n;
      }

      const swapTx = await routerWithSigner.exactInputSingle(swapParams, txOptions);

      console.log('Swap transaction sent:', swapTx.hash);
      const receipt = await swapTx.wait();
      console.log('Swap confirmed:', receipt.transactionHash);

      // If swapping to native ETH, unwrap WETH
      if (toToken.tokenAddress === '0x0000000000000000000000000000000000000000') {
        const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
        const wethBalance = await wethContract.balanceOf(recipient);
        if (wethBalance > 0n) {
          console.log('Unwrapping WETH to ETH...');
          const unwrapTx = await wethContract.withdraw(wethBalance);
          await unwrapTx.wait();
          console.log('WETH unwrapped:', unwrapTx.hash);
        }
      }
      
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
  ): Promise<{ swapTxHashes: string[]; approveTxHashes: string[] }> {
    const swapTxHashes: string[] = [];
    const approveTxHashes: string[] = [];
    
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
      const approveHashes = await this.batchApproveTokens(tokenAddresses, amounts, signer);
      approveTxHashes.push(...approveHashes);
    }

    // Execute swaps sequentially
    for (let i = 0; i < swaps.length; i++) {
      const swap = swaps[i];
      try {
        console.log(`Executing swap ${i + 1}/${swaps.length}: ${swap.fromToken.symbol} -> ${swap.toToken.symbol}`);
        
        // Check allowance if not ETH
        if (swap.fromToken.address !== '0x0000000000000000000000000000000000000000') {
          const tokenContract = new ethers.Contract(swap.fromToken.address, ERC20_ABI, signer);
          const userAddress = await signer.getAddress();
          const allowance = await tokenContract.allowance(userAddress, SWAP_ROUTER_ADDRESS);
          
          if (allowance < swap.amountIn) {
            console.warn(`Token ${swap.fromToken.symbol} not fully approved, approving now...`);
            const approveHash = await this.approveToken(swap.fromToken.address, signer, swap.amountIn);
            if (approveHash) approveTxHashes.push(approveHash);
          }
        }
        
        const txHash = await this.executeSwap(
          swap.fromToken,
          swap.toToken,
          swap.amountIn,
          recipient,
          signer,
          slippageTolerance,
          true // Skip approval since we already did it
        );
        
        if (txHash) {
          swapTxHashes.push(txHash);
        }
        
        // Small delay between swaps to avoid nonce issues
        if (i < swaps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error executing swap ${i + 1}:`, error);
        // Continue with other swaps even if one fails
      }
    }

    return { swapTxHashes, approveTxHashes };
  }
}