import { ethers } from 'ethers';
import { TokenInfo, ConversionOption, ConversionQuote, ConversionRequest } from '../types/token';

// Uniswap V3 Router ABI (simplified)
const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) external payable returns (uint256 amountOut)',
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
];

// Uniswap V3 Router address on Base
const UNISWAP_ROUTER_ADDRESS = '0x2626664c2603336E57B271c5C0b26F421741e481';

export class TokenConversionService {
  private provider: ethers.JsonRpcProvider;
  private routerContract: ethers.Contract;

  constructor(rpcUrl: string = 'https://mainnet.base.org') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS,
      UNISWAP_ROUTER_ABI,
      this.provider
    );
  }

  // Get conversion quote for a single token
  async getConversionQuote(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    slippageTolerance: number = 0.5
  ): Promise<ConversionQuote> {
    try {
      const amountIn = ethers.parseUnits(fromToken.balanceFormatted, fromToken.decimals);
      const path = [fromToken.address, toToken.tokenAddress];
      
      // Get amounts out from Uniswap
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      const amountOut = amounts[1];
      
      // Calculate minimum amount out with slippage
      const slippageBps = Math.floor(slippageTolerance * 100);
      const amountOutMinimum = (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000);
      
      // Estimate gas (simplified)
      const gasEstimate = this.estimateSwapGas(fromToken.address, toToken.tokenAddress);
      
      // Calculate price impact (simplified)
      const priceImpact = this.calculatePriceImpact(fromToken, toToken, amountIn, amountOut);

      return {
        fromToken,
        toToken,
        amountOut: ethers.formatUnits(amountOut, 18), // Assuming 18 decimals for output
        priceImpact,
        gasEstimate,
        route: path,
      };
    } catch (error) {
      console.error('Error getting conversion quote:', error);
      throw new Error('Failed to get conversion quote');
    }
  }

  // Get conversion quotes for multiple tokens
  async getBatchConversionQuotes(
    tokens: TokenInfo[],
    toToken: ConversionOption,
    slippageTolerance: number = 0.5
  ): Promise<ConversionQuote[]> {
    const quotes: ConversionQuote[] = [];
    
    for (const token of tokens) {
      try {
        const quote = await this.getConversionQuote(token, toToken, slippageTolerance);
        quotes.push(quote);
      } catch (error) {
        console.error(`Failed to get quote for ${token.symbol}:`, error);
      }
    }
    
    return quotes;
  }

  // Execute token conversion
  async executeConversion(
    quote: ConversionQuote,
    userAddress: string,
    slippageTolerance: number = 0.5
  ): Promise<string> {
    try {
      // This would require a wallet/signer to execute the transaction
      // For now, we'll return a mock transaction hash
      console.log('Executing conversion:', quote);
      
      // In a real implementation, you would:
      // 1. Check token allowance
      // 2. Approve token spending if needed
      // 3. Execute the swap transaction
      // 4. Return the transaction hash
      
      return '0x' + Math.random().toString(16).substr(2, 64);
    } catch (error) {
      console.error('Error executing conversion:', error);
      throw new Error('Failed to execute conversion');
    }
  }

  // Execute batch conversion
  async executeBatchConversion(
    quotes: ConversionQuote[],
    userAddress: string,
    slippageTolerance: number = 0.5
  ): Promise<string[]> {
    const txHashes: string[] = [];
    
    for (const quote of quotes) {
      try {
        const txHash = await this.executeConversion(quote, userAddress, slippageTolerance);
        txHashes.push(txHash);
      } catch (error) {
        console.error(`Failed to execute conversion for ${quote.fromToken.symbol}:`, error);
      }
    }
    
    return txHashes;
  }

  // Estimate gas cost for swap
  private estimateSwapGas(fromToken: string, toToken: string): string {
    // Simplified gas estimation
    const baseGas = 150000; // Base gas for swap
    const gasPrice = 0.000000001; // 1 gwei
    
    const totalGas = baseGas;
    const gasCostETH = (totalGas * gasPrice) / 1e9;
    
    return gasCostETH.toFixed(6);
  }

  // Calculate price impact (simplified)
  private calculatePriceImpact(
    fromToken: TokenInfo,
    toToken: ConversionOption,
    amountIn: bigint,
    amountOut: bigint
  ): number {
    // This is a simplified calculation
    // In reality, you'd need to get the current market price and calculate impact
    const impact = Math.random() * 2; // Random impact between 0-2%
    return parseFloat(impact.toFixed(2));
  }

  // Check if token needs approval
  async needsApproval(tokenAddress: string, userAddress: string, amount: string): Promise<boolean> {
    try {
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return false; // ETH doesn't need approval
      }

      const erc20Abi = ['function allowance(address owner, address spender) view returns (uint256)'];
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      
      const allowance = await tokenContract.allowance(userAddress, UNISWAP_ROUTER_ADDRESS);
      const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals
      
      return allowance < amountWei;
    } catch (error) {
      console.error('Error checking approval:', error);
      return true; // Assume needs approval if check fails
    }
  }
}
