import React, { useEffect } from 'react';
import DustAggregator from './components/DustAggregator-simple';
import DustLogo from './components/Logo';

// Generate floating particles
const DustParticles = () => {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 8}s`,
    size: Math.random() * 3 + 2,
  }));

  return (
    <div className="dust-particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="dust-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
};

function App() {
  useEffect(() => {
    console.log('Dust Token Aggregator loaded successfully!');
  }, []);

  return (
    <>
      {/* Animated background */}
      <div className="dust-bg" />
      <DustParticles />

      <div className="min-h-screen relative">
        {/* Header */}
        <header className="relative border-b border-dust">
          <div className="container mx-auto px-6 py-8">
            <div className="flex items-center gap-5">
              <div className="relative">
                <DustLogo size={72} />
                <div className="absolute inset-0 dust-glow rounded-full opacity-50" />
              </div>
              <div>
                <h1 className="dust-heading-xl dust-text-gradient mb-2">
                  Dust
                </h1>
                <p className="text-dust-secondary text-lg font-light tracking-wide">
                  Collect & consolidate your small token balances on Base
                </p>
              </div>
            </div>
          </div>

          {/* Decorative gradient line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--dust-gold-500)] to-transparent opacity-50" />
        </header>

        {/* Main content */}
        <main className="container mx-auto px-6 py-10">
          <DustAggregator />
        </main>

        {/* Footer */}
        <footer className="border-t border-dust py-8 mt-16">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <DustLogo size={28} />
                <span className="text-dust-muted text-sm">
                  © 2024 Dust Token Aggregator
                </span>
              </div>
              <div className="flex items-center gap-6">
                <a 
                  href="https://basescan.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-dust-secondary hover:text-[var(--dust-gold-400)] transition-colors text-sm"
                >
                  BaseScan
                </a>
                <a 
                  href="https://base.org" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-dust-secondary hover:text-[var(--dust-gold-400)] transition-colors text-sm"
                >
                  Base Network
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;
