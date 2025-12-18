import React, { useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import confetti from 'canvas-confetti';

interface SwapSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountReceived: string;
  tokenSymbol: string;
  usdValue: number;
  txHash: string;
  onScanMore: () => void;
  onDisconnect: () => void;
}

const CheckIcon = () => (
  <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const SwapSuccessModal: React.FC<SwapSuccessModalProps> = ({
  isOpen,
  onClose,
  amountReceived,
  tokenSymbol,
  usdValue,
  txHash,
  onScanMore,
  onDisconnect,
}) => {
  const confettiIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Stop confetti when modal closes
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
      return;
    }

    // Start continuous confetti animation
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // Continuous confetti bursts
    confettiIntervalRef.current = setInterval(() => {
      const particleCount = 30;
      
      // Launch confetti from left
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#9370DB']
      });
      
      // Launch confetti from right
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#9370DB']
      });
    }, 300);

    // Initial burst
    setTimeout(() => {
      confetti({
        ...defaults,
        particleCount: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FF6347', '#32CD32', '#1E90FF', '#9370DB']
      });
    }, 100);

    // Cleanup on unmount
    return () => {
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
        confettiIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getExplorerUrl = (hash: string) => {
    return `https://basescan.org/tx/${hash}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="dust-card max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
            <CheckIcon />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-dust-text-primary mb-3">
          Swap Successful!
        </h2>

        {/* Message */}
        <p className="text-dust-text-secondary mb-6">
          Your dust tokens have been successfully swapped into {tokenSymbol}
        </p>

        {/* Amount Received Card */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20 rounded-xl p-6 mb-6">
          <p className="text-sm text-dust-text-secondary mb-2">You received</p>
          <div className="break-words">
            <p className="text-2xl sm:text-3xl font-bold text-dust-text-primary mb-1">
              {parseFloat(amountReceived).toLocaleString('en-US', {
                maximumFractionDigits: 8,
                minimumFractionDigits: 0
              })}
            </p>
            <p className="text-xl sm:text-2xl font-bold text-dust-text-primary">
              {tokenSymbol}
            </p>
          </div>
          <p className="text-sm text-dust-text-muted">
            ≈ {formatUSD(usdValue)} USD
          </p>
        </div>

        {/* Transaction Hash */}
        <div className="mb-6">
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-dust-sapphire hover:text-dust-sapphire/80 transition-colors break-all"
          >
            View on Basescan: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </a>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onScanMore}
            className="w-full dust-btn-primary py-3 px-6 rounded-xl font-semibold text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30"
          >
            Scan for More Dust
          </button>
          
          <button
            onClick={onDisconnect}
            className="w-full text-dust-text-secondary hover:text-dust-text-primary transition-colors text-sm"
          >
            Disconnect Wallet
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-dust-text-muted hover:text-dust-text-primary transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SwapSuccessModal;

