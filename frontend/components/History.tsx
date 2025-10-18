'use client';

import { useEffect, useState } from 'react';
import { getHistoryItems, HistoryItem } from '../lib/storage';

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => {
    setItems(getHistoryItems());
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Recent Swaps</h2>
      <div className="rounded border border-neutral-800 divide-y divide-neutral-800">
        {items.map((it) => (
          <div key={it.hash} className="p-3 text-sm flex items-center justify-between">
            <div>
              <div className="font-medium">
                {it.sellToken.symbol} → {it.buyToken.symbol}
              </div>
              <div className="text-neutral-400">
                {new Date(it.timestamp).toLocaleString()} · Chain {it.chainId}
              </div>
            </div>
            <a
              href={it.chainId === 1 ? `https://etherscan.io/tx/${it.hash}` : `https://basescan.org/tx/${it.hash}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline"
            >
              View on explorer
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
