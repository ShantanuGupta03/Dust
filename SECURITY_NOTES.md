# Security & Frontend Logic Hiding

## Current Status

### ✅ Already Protected (Serverless Functions)
- **0x API Key**: Stored in `process.env.ZEROX_API_KEY` in serverless functions
- **API Calls**: All 0x API calls go through `/api/0x-price` and `/api/0x-quote` proxies
- **Headers**: `0x-version` and `0x-api-key` headers are added server-side

### ⚠️ Still Exposed in Frontend
The following logic is currently visible in browser DevTools:

1. **Token Discovery Logic**
   - Basescan API key (if used client-side)
   - RPC endpoints
   - Token scanning algorithms

2. **Price Calculation**
   - Price fetching logic
   - USD conversion formulas

3. **Swap Logic**
   - Slippage calculations
   - Amount formatting
   - Transaction construction

## Recommendations

### High Priority: Move to Serverless Functions

1. **Token Discovery Service**
   ```typescript
   // Create: api/discover-tokens.ts
   // Move: ComprehensiveTokenDiscovery logic
   // Hide: Basescan API key, RPC URLs
   ```

2. **Price Service**
   ```typescript
   // Create: api/get-prices.ts
   // Move: PriceService.getTokenPrices()
   // Hide: Price API keys, calculation logic
   ```

3. **Token Metadata**
   ```typescript
   // Create: api/token-metadata.ts
   // Move: Token name/symbol/decimals fetching
   // Hide: RPC calls, API keys
   ```

### Medium Priority

4. **Swap Quote Validation**
   - Move quote validation to server
   - Add rate limiting
   - Validate amounts server-side

5. **History Storage**
   - Consider moving from localStorage to backend
   - Add user authentication
   - Store on server for cross-device access

### Low Priority (Can Stay Client-Side)

- UI state management
- Theme preferences
- User selections
- Display formatting

## Implementation Example

### Before (Client-Side)
```typescript
// src/services/ComprehensiveTokenDiscovery.ts
const BASESCAN_API_KEY = import.meta.env.VITE_BASESCAN_API_KEY; // ❌ Exposed
const response = await fetch(`https://api.basescan.org/api?...&apikey=${BASESCAN_API_KEY}`);
```

### After (Serverless Function)
```typescript
// api/discover-tokens.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;
  const apiKey = process.env.BASESCAN_API_KEY; // ✅ Hidden
  
  const response = await fetch(`https://api.basescan.org/api?...&apikey=${apiKey}`);
  // ... process and return
}

// Frontend
const response = await fetch(`/api/discover-tokens?address=${walletAddress}`);
```

## Benefits

1. **API Keys Protected**: Never exposed to users
2. **Rate Limiting**: Can add rate limiting server-side
3. **Validation**: Validate inputs before processing
4. **Caching**: Cache responses server-side
5. **Analytics**: Track usage without exposing logic

## Next Steps

1. Create `api/discover-tokens.ts` serverless function
2. Create `api/get-prices.ts` serverless function  
3. Update frontend to call these endpoints
4. Remove API keys from client-side code
5. Add environment variables to Vercel dashboard

