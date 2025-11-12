import React, { useEffect } from 'react';
import DustAggregator from './components/DustAggregator-simple';

function App() {
  useEffect(() => {
    console.log('Dust Token Aggregator loaded successfully!');
  }, []);

  return (
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
        <DustAggregator />
      </main>
    </div>
  );
}

export default App;
