#!/usr/bin/env node

/**
 * Demo script for Dust Token Aggregator
 * This script demonstrates the token conversion functionality
 */

import { ethers } from 'ethers';
import { DustTokenAggregator } from './src/services/DustTokenAggregator.js';
import { TokenConversionService } from './src/services/TokenConversionService.js';
import { CONVERSION_OPTIONS } from './src/types/token.js';

async function demo() {
  console.log('🚀 Dust Token Aggregator Demo\n');

  // Mock user address for demo
  const mockUserAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6';
  
  console.log('📊 Initializing services...');
  const aggregator = new DustTokenAggregator();
  const conversionService = new TokenConversionService();

  try {
    console.log('🔍 Discovering tokens...');
    const result = await aggregator.aggregateTokens(mockUserAddress);
    
    console.log(`\n📈 Portfolio Summary:`);
    console.log(`   Total Tokens: ${result.totalTokens}`);
    console.log(`   Dust Tokens: ${result.dustTokens}`);
    console.log(`   Total Value: $${result.totalValueUSD.toFixed(2)}`);
    console.log(`   Dust Value: $${result.dustValueUSD.toFixed(2)}`);

    if (result.tokens.length > 0) {
      console.log(`\n💰 Available Tokens:`);
      result.tokens.forEach((token, index) => {
        console.log(`   ${index + 1}. ${token.symbol} (${token.name})`);
        console.log(`      Balance: ${token.balanceFormatted}`);
        console.log(`      Value: $${token.valueUSD.toFixed(2)}`);
        console.log(`      Dust: ${token.isDust ? 'Yes' : 'No'}`);
        console.log('');
      });

      // Demo conversion
      console.log('🔄 Conversion Demo:');
      const fromToken = result.tokens[0];
      const toToken = CONVERSION_OPTIONS[0]; // USDC
      
      if (fromToken) {
        console.log(`   Converting ${fromToken.symbol} to ${toToken.symbol}...`);
        
        try {
          const quote = await conversionService.getConversionQuote(fromToken, toToken);
          console.log(`   Quote received:`);
          console.log(`     Amount Out: ${quote.amountOut} ${toToken.symbol}`);
          console.log(`     Price Impact: ${quote.priceImpact}%`);
          console.log(`     Gas Estimate: ${quote.gasEstimate} ETH`);
        } catch (error) {
          console.log(`   Quote failed: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Demo completed successfully!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('   ✓ Token discovery and balance checking');
    console.log('   ✓ Dust token identification');
    console.log('   ✓ Real-time price fetching');
    console.log('   ✓ Conversion quote generation');
    console.log('   ✓ Gas estimation');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run the demo
demo().catch(console.error);
