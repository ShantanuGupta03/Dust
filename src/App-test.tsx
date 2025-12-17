import React from 'react';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-white">
            <header className="border-b border-gray-200 bg-gray-50">
              <div className="container mx-auto px-4 py-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  Dust Token Aggregator
                </h1>
                <p className="text-gray-600 mt-2">
                  Collect and manage your dust tokens on Base network
                </p>
              </div>
            </header>
            <main className="container mx-auto px-4 py-8">
              <div className="max-w-md mx-auto">
                <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
                  <h2 className="text-2xl font-semibold mb-4 text-gray-900">Test Page</h2>
                  <p className="text-gray-600 mb-6">
                    If you can see this, the app is working!
                  </p>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Test Button
                  </button>
                </div>
              </div>
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App;
