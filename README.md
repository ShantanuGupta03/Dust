# Dust Token Swapper (MVP Scaffold)

Cross-chain "Dust Token Swapper" to consolidate small ERC20 balances into a chosen asset.

## Tech Stack
- Frontend: Next.js 14 + TypeScript + TailwindCSS
- Wallet: Wagmi v2 + RainbowKit
- Backend: Node.js + Express + TypeScript
- Chains (Iter. 1): Ethereum Mainnet (1), Base (8453)
- Aggregator: 0x API (quotes + swap calldata)
- Pricing: DefiLlama prices API

## Monorepo Structure
```
frontend/   # Next.js app (UI, wallet connect, balances, swap flow)
backend/    # Express API (prices, quote)
```

## Prerequisites
- Node.js 18+
- A WalletConnect Cloud Project ID (free) for RainbowKit

## Setup
1. Install dependencies:
   ```bash
   cd backend && npm i && cd ../frontend && npm i
   ```
2. Configure env files:
   - `backend/.env` (copy from `.env.example`):
     - `PORT=4000`
     - `ALLOWED_ORIGINS=http://localhost:3000`
     - `ONEINCH_API_KEY=` (optional, not used by default)
   - `frontend/.env` (copy from `.env.example`):
     - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id`
     - `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`

## Run locally
In two terminals:
```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health

## What works in MVP
- Connect wallet (MetaMask, WalletConnect) on Ethereum or Base
- Load a small curated token list per chain
- Read ERC20 balances and show USD values (DefiLlama)
- Select tokens and a target token
- Request per-token 0x aggregator quote and execute sequential swaps
- Store recent swaps in local storage

## Notes
- Quotes and swaps use 0x API. For ERC20→ERC20 only in this MVP (no native ETH). Approvals handled per token as needed.
- Pricing comes from DefiLlama (no API key). You can swap in Coingecko later.
- Base USDC address used: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (native USDC on Base).

## Where to plug APIs later
- Add CowSwap or 1inch fallback in `backend/src/services/quote.ts`
- Add Solana via Jupiter in a new `solana/` service and a Phantom connector in frontend
- Add DB (Supabase/Mongo) to persist history and user settings
- Add auto-select dust thresholds in frontend (currently button selects <$5)
- Add batch routing contract or CowSwap intents to combine steps

## Security & Safety
- Always show quotes and slippage before submission (MVP uses fixed 0.5% in backend)
- Consider approvals with Permit2 or exact-amount approvals
- Add chain gating and simulation before sending transactions

## Scripts
- Backend: `npm run dev` (hot reload via tsx), `npm run build && npm start`
- Frontend: `npm run dev`, `npm run build && npm start`

## Iteration Plan
- Iteration 1 (this scaffold): Ethereum + Base, sequential swaps
- Iteration 2: Add Arbitrum, Optimism (update chain maps and token lists)
- Iteration 3: Solana via Jupiter + Phantom
- Iteration 4: Improved dust auto-selection and portfolio views
- Iteration 5: Batch transactions via CowSwap intents or custom router
