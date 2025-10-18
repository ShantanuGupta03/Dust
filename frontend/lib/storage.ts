import { TokenInfo } from './tokens';

export type HistoryItem = {
  hash: string;
  chainId: number;
  sellToken: TokenInfo;
  buyToken: TokenInfo;
  timestamp: number;
  status: 'success' | 'reverted' | 'pending' | undefined;
};

const KEY = 'dust_swap_history_v1';

export function addHistoryItem(item: HistoryItem) {
  try {
    const prev = getHistoryItems();
    const next = [item, ...prev].slice(0, 20);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getHistoryItems(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
