#!/bin/bash

echo "🚀 Setting up Dust Token Aggregator..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# WalletConnect Project ID
# Get this from https://cloud.walletconnect.com/
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
EOF
    echo "⚠️  Please update .env file with your WalletConnect Project ID"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Get your WalletConnect Project ID from https://cloud.walletconnect.com/"
echo "2. Update the .env file with your project ID"
echo "3. Run 'npm run dev' to start the development server"
echo ""
echo "Happy aggregating! 🪙"

