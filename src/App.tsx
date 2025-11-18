import React, { useEffect } from 'react';
import DustAggregator from './components/DustAggregator-simple';
import DustLogo from './components/Logo';

function App() {
  useEffect(() => {
    console.log('Dust Token Aggregator loaded successfully!');
  }, []);

  return (
    <div className="min-h-screen">
      <header className="premium-card border-b border-white/10 mb-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-4 mb-4">
            <DustLogo size={56} className="glow-gold" />
            <div>
              <h1 className="text-4xl font-bold text-gradient mb-2">
                Dust Token Aggregator
              </h1>
              <p className="text-gray-300 text-lg">
                Collect and manage your dust tokens on Base network
              </p>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <DustAggregator />
      </main>
    </div>
  );
}

export default App;
