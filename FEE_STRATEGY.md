# 10 BPS Fee Implementation Strategy

## Overview
We want to charge a **10 basis points (0.1%)** fee on all swaps. This document outlines the best approaches for implementing and collecting this fee.

## Fee Calculation
- **10 bps = 0.1% = 0.001**
- Example: On a $100 swap, fee = $0.10

## Implementation Options

### Option 1: Fee on Output (Recommended) ✅
**How it works:**
- User receives slightly less output tokens
- Fee is deducted from the `buyAmount` received
- Most transparent and user-friendly

**Implementation:**
```typescript
// In BatchSwapService.executeSwap()
const quote = await this.getSwapQuote(...);
const buyAmount = BigInt(quote.buyAmount);
const feeAmount = (buyAmount * 10n) / 10000n; // 10 bps
const userReceives = buyAmount - feeAmount;

// Send fee to fee recipient address
// User receives userReceives amount
```

**Pros:**
- User sees exactly what they'll receive (with fee already deducted)
- No additional transaction needed
- Simple UX - "You'll receive X tokens (0.1% fee included)"

**Cons:**
- Slightly less output for user (but expected)

### Option 2: Fee on Input
**How it works:**
- User sends slightly more input tokens
- Fee is added to the `sellAmount`

**Implementation:**
```typescript
const sellAmount = amountIn;
const feeAmount = (sellAmount * 10n) / 10000n;
const totalSellAmount = sellAmount + feeAmount;
```

**Pros:**
- User receives full expected output
- Fee is "hidden" in the input

**Cons:**
- User might not realize they're paying more
- Less transparent

### Option 3: Separate Fee Transaction
**How it works:**
- Execute swap normally
- Send separate transaction for fee

**Pros:**
- Clear separation of swap and fee

**Cons:**
- Requires two transactions (more gas)
- More complex UX
- User might reject fee transaction

## Recommended Approach: Option 1 (Fee on Output)

### Implementation Steps

1. **Create Fee Recipient Address**
   ```typescript
   const FEE_RECIPIENT = "0x..."; // Your fee collection address
   const FEE_BPS = 10; // 10 basis points
   ```

2. **Modify Swap Execution**
   - After getting quote from 0x API
   - Calculate fee: `feeAmount = (buyAmount * FEE_BPS) / 10000`
   - Modify the swap transaction to:
     - Send `buyAmount - feeAmount` to user
     - Send `feeAmount` to `FEE_RECIPIENT`

3. **Update Quote Display**
   - Show user: "You'll receive X tokens (0.1% fee included)"
   - Or: "You'll receive X tokens (fee: Y tokens)"

4. **Transaction Structure**
   - Option A: Modify 0x swap transaction data (complex, may break)
   - Option B: Use a proxy contract that:
     - Receives user's tokens
     - Executes swap via 0x
     - Distributes output: (buyAmount - fee) to user, fee to recipient
   - Option C: Post-swap transfer (requires approval, extra gas)

### Best Implementation: Proxy Contract (Option B)

**Why:**
- Clean separation of concerns
- Can enforce fee collection
- Works with any DEX aggregator
- Single transaction for user

**Contract Flow:**
```
1. User approves proxy contract
2. User calls swap() on proxy
3. Proxy:
   - Takes user's tokens
   - Calls 0x API swap
   - Receives output tokens
   - Sends (output - fee) to user
   - Sends fee to fee recipient
```

**Contract Example (Solidity):**
```solidity
contract DustSwapProxy {
    address public constant FEE_RECIPIENT = 0x...;
    uint256 public constant FEE_BPS = 10; // 0.1%
    
    function swap(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        bytes calldata swapData // From 0x API
    ) external {
        // Transfer tokens from user
        IERC20(sellToken).transferFrom(msg.sender, address(this), sellAmount);
        
        // Execute swap via 0x
        (bool success, bytes memory result) = address(0x...).call(swapData);
        require(success, "Swap failed");
        
        // Get buy amount from result
        uint256 buyAmount = ...;
        
        // Calculate fee
        uint256 fee = (buyAmount * FEE_BPS) / 10000;
        
        // Transfer to user and fee recipient
        IERC20(buyToken).transfer(msg.sender, buyAmount - fee);
        IERC20(buyToken).transfer(FEE_RECIPIENT, fee);
    }
}
```

## Alternative: Server-Side Fee Collection

If you don't want to deploy a contract, you could:
1. Collect fees off-chain (track in database)
2. Charge users a subscription or premium tier
3. Use affiliate/referral system

But this is less reliable and harder to enforce.

## Recommendation

**Deploy a proxy contract** that:
- Wraps 0x swaps
- Automatically deducts 10 bps fee
- Sends fee to your address
- Provides clean UX (single transaction)

This is the most professional and reliable approach.

## Next Steps

1. ✅ Design fee collection mechanism (this document)
2. ⏳ Deploy proxy contract to Base
3. ⏳ Update BatchSwapService to use proxy
4. ⏳ Update UI to show fee information
5. ⏳ Test fee collection
6. ⏳ Monitor fee accumulation

