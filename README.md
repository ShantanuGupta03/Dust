# Dust Token Aggregator

A modern web3 application for collecting and managing dust tokens on the Base network. Built with React, TypeScript, and ethers.js.

## Features

- 🔍 **Token Discovery**: Automatically discover tokens in your wallet
- 💰 **Dust Detection**: Identify low-value tokens based on customizable thresholds
- 📊 **Real-time Pricing**: Get current USD and ETH values for all tokens
- ⚙️ **Customizable Thresholds**: Set your own ETH and USD thresholds for dust detection
- 🔄 **Token Conversion**: Convert multiple tokens to USDC, ETH, or WETH in one click
- 🎯 **Batch Operations**: Select and convert multiple tokens simultaneously
- 📈 **Conversion Quotes**: Get real-time quotes with price impact and gas estimates
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- 🔗 **Wallet Integration**: Connect with RainbowKit and WalletConnect
- ⛽ **Gas Estimation**: Estimate gas costs for aggregation operations

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Web3**: ethers.js, wagmi, RainbowKit
- **State Management**: TanStack Query
- **Network**: Base (Ethereum L2)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- A Base network wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Dust
```

2. Install dependencies:
```bash
npm install
```

3. Configure your WalletConnect project ID:
   - Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
   - Create a new project
   - Copy your project ID
   - Update `src/config/wagmi.ts` with your project ID

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and select your preferred wallet
2. **Set Thresholds**: Configure your dust token thresholds (default: 0.001 ETH or $5 USD)
3. **View Tokens**: Browse your tokens, filtered by dust/regular status
4. **Convert Tokens**: 
   - Select tokens you want to convert
   - Choose target token (USDC, ETH, or WETH)
   - Set slippage tolerance
   - Review conversion quotes
   - Execute conversion in one click
5. **Analyze**: Review the aggregation summary and gas estimates

## Configuration

### Dust Thresholds

You can customize what constitutes a "dust" token:

- **ETH Threshold**: Minimum ETH value (default: 0.001 ETH)
- **USD Threshold**: Minimum USD value (default: $5.00)

A token is considered dust if it meets either threshold condition.

### Supported Tokens

The aggregator currently supports:
- ETH (native)
- USDC
- USDT  
- DAI
- WETH

### Conversion Options

You can convert your tokens to:
- **USDC**: Stablecoin for stable value
- **ETH**: Native Ethereum for gas and trading
- **WETH**: Wrapped Ethereum for DeFi protocols

## Architecture

```
src/
├── components/          # React components
│   ├── DustAggregator.tsx
│   ├── TokenList.tsx
│   ├── TokenConverter.tsx
│   ├── AggregationSummary.tsx
│   └── ThresholdSettings.tsx
├── services/           # Business logic
│   ├── BaseTokenService.ts
│   ├── DustTokenFilter.ts
│   ├── PriceService.ts
│   ├── TokenConversionService.ts
│   └── DustTokenAggregator.ts
├── types/             # TypeScript types
│   └── token.ts
└── config/            # Configuration
    └── wagmi.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This software is provided "as is" without warranty. Always verify transactions and gas costs before executing. Use at your own risk.