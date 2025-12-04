import { ethers } from 'ethers';
import { TokenInfo, ConversionOption } from '../types/token';

// Uniswap V3 SwapRouter02 ABI
const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external payable returns (uint256 amountOut)',
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

  // Check if a token has liquidity (pool exists) against USDC, WETH, or ETH
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

      // Check against WETH
      const hasWethPool = await this.findBestFeeTier(tokenIn, WETH_ADDRESS, testAmount);
      if (hasWethPool) {
        return true;
      }

      // Check against native ETH (via WETH)
      // If token can swap to WETH, it can effectively swap to ETH
      if (hasWethPool) {
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error checking liquidity for ${tokenAddress}:`, error);
      return false;
    }
  }

  // Check liquidity with actual swap amount against USDC, WETH, or ETH
  async checkTokenLiquidityWithAmount(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: bigint
  ): Promise<boolean> {
    try {
      // Skip check for native ETH and WETH
      if (tokenInAddress === '0x0000000000000000000000000000000000000000' || 
          tokenInAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
        return true;
      }

      const tokenIn = tokenInAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : tokenInAddress;
      
      // Normalize tokenOut - if ETH, use WETH
      let tokenOut = tokenOutAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : tokenOutAddress;

      // If checking against ETH, also check USDC and WETH as alternatives
      if (tokenOutAddress === '0x0000000000000000000000000000000000000000') {
        // Check USDC first (most liquid)
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const hasUsdcRoute = await this.findBestRoute(tokenIn, usdcAddress, amountIn);
        if (hasUsdcRoute) {
          return true;
        }
        
        // Check WETH (can unwrap to ETH)
        const hasWethRoute = await this.findBestRoute(tokenIn, WETH_ADDRESS, amountIn);
        if (hasWethRoute) {
          return true;
        }
        
        return false;
      }

      // Check if pool exists and can handle the actual swap amount
      const bestRoute = await this.findBestRoute(tokenIn, tokenOut, amountIn);
      return bestRoute !== null;
    } catch (error) {
      console.error(`Error checking liquidity with amount for ${tokenInAddress}:`, error);
      return false;
    }
  }

  // Find the best route for a token pair (direct or via WETH)
  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ fee: number; amountOut: bigint; path?: string; isMultiHop: boolean } | null> {
    // Try direct swap first
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
          return { fee, amountOut, isMultiHop: false };
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
              // Build path: tokenIn (20 bytes) + fee1 (3 bytes) + WETH (20 bytes) + fee2 (3 bytes) + tokenOut (20 bytes)
              // Uniswap V3 path encoding: concatenate addresses and fees as bytes
              // Remove '0x' prefix and pad fee to 3 bytes
              const tokenInBytes = ethers.getBytes(tokenIn);
              const fee1Bytes = ethers.zeroPadValue(ethers.toBeHex(fee1), 3);
              const wethBytes = ethers.getBytes(WETH_ADDRESS);
              const fee2Bytes = ethers.zeroPadValue(ethers.toBeHex(fee2), 3);
              const tokenOutBytes = ethers.getBytes(tokenOut);
              
              // Concatenate: tokenIn + fee1 + WETH + fee2 + tokenOut
              const path = ethers.concat([
                tokenInBytes,
                fee1Bytes,
                wethBytes,
                fee2Bytes,
                tokenOutBytes,
              ]);
              
              return { fee: fee1, amountOut, path, isMultiHop: true };
            }
          } catch (error) {
            continue;
          }
        }
      }
    }
    
    return null;
  }

  // Find the best fee tier for a token pair (backward compatibility)
  async findBestFeeTier(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{ fee: number; amountOut: bigint } | null> {
    const route = await this.findBestRoute(tokenIn, tokenOut, amountIn);
    if (!route) return null;
    return { fee: route.fee, amountOut: route.amountOut };
  }

  // Get swap quote using Uniswap V3
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    slippageTolerance: number = 0.5
  ): Promise<{ amountOut: bigint; amountOutMinimum: bigint; fee: number; path?: string; isMultiHop: boolean }> {
    try {
      const tokenIn = fromToken.address === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : fromToken.address;
      
      const tokenOut = toToken.tokenAddress === '0x0000000000000000000000000000000000000000'
        ? WETH_ADDRESS
        : toToken.tokenAddress;

      // If swapping to ETH, try USDC first (most liquid), then WETH
      if (toToken.tokenAddress === '0x0000000000000000000000000000000000000000') {
        const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        // Try USDC first
        let bestRoute = await this.findBestRoute(tokenIn, usdcAddress, amountIn);
        if (bestRoute) {
          const { amountOut, fee, path, isMultiHop } = bestRoute;
          const slippageBps = Math.floor(slippageTolerance * 100);
          const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
          return { amountOut, amountOutMinimum, fee, path, isMultiHop };
        }
        
        // Fallback to WETH
        bestRoute = await this.findBestRoute(tokenIn, WETH_ADDRESS, amountIn);
        if (bestRoute) {
          const { amountOut, fee, path, isMultiHop } = bestRoute;
          const slippageBps = Math.floor(slippageTolerance * 100);
          const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
          return { amountOut, amountOutMinimum, fee, path, isMultiHop };
        }
      }

      // Find best route (direct or multi-hop)
      const bestRoute = await this.findBestRoute(tokenIn, tokenOut, amountIn);
      
      if (!bestRoute) {
        throw new Error('No liquidity pool found for this token pair');
      }

      const { amountOut, fee, path, isMultiHop } = bestRoute;
      const slippageBps = Math.floor(slippageTolerance * 100);
      const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);

      return { amountOut, amountOutMinimum, fee, path, isMultiHop };
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

      // Re-fetch quote right before swap to ensure it's fresh and valid
      // This prevents "Pool liquidity changed" errors
      console.log('Re-fetching fresh quote before swap...');
      const freshQuote = await this.getSwapQuote(fromToken, toToken, amountIn, slippageTolerance);
      
      if (!freshQuote) {
        throw new Error('No valid route found. Pool may not have enough liquidity.');
      }

      // Execute swap
      console.log(`Executing swap via Uniswap V3 (${freshQuote.isMultiHop ? 'multi-hop' : 'direct'})...`);
      const routerWithSigner = this.routerContract.connect(signer);
      
      // For native ETH swaps, we need to send ETH value
      const txOptions: any = {};
      if (fromToken.address === '0x0000000000000000000000000000000000000000') {
        // We already wrapped ETH, so no value needed
        txOptions.value = 0n;
      }

      let swapTx;
      
      if (freshQuote.isMultiHop && freshQuote.path) {
        // Multi-hop swap using exactInput with path
        const swapParams = {
          path: freshQuote.path,
          recipient,
          deadline,
          amountIn,
          amountOutMinimum: freshQuote.amountOutMinimum,
        };

        // Try to estimate gas first
        try {
          await routerWithSigner.exactInput.estimateGas(swapParams, txOptions);
        } catch (estimateError) {
          console.error('Gas estimation failed for multi-hop:', estimateError);
          throw new Error(`Swap would fail: ${estimateError instanceof Error ? estimateError.message : 'Unknown error'}. The pool may not have enough liquidity for this amount.`);
        }

        swapTx = await routerWithSigner.exactInput(swapParams, txOptions);
      } else {
        // Direct swap using exactInputSingle
        const swapParams = {
          tokenIn,
          tokenOut,
          fee: freshQuote.fee,
          recipient,
          deadline,
          amountIn,
          amountOutMinimum: freshQuote.amountOutMinimum,
          sqrtPriceLimitX96: 0,
        };

        // Try to estimate gas first
        try {
          await routerWithSigner.exactInputSingle.estimateGas(swapParams, txOptions);
        } catch (estimateError) {
          console.error('Gas estimation failed:', estimateError);
          throw new Error(`Swap would fail: ${estimateError instanceof Error ? estimateError.message : 'Unknown error'}. The pool may not have enough liquidity for this amount.`);
        }

        swapTx = await routerWithSigner.exactInputSingle(swapParams, txOptions);
      }

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