import { ConnectButton } from '@rainbow-me/rainbowkit';
import SwapForm from '../components/SwapForm';
import History from '../components/History';

export default function Page() {
  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dust Token Swapper</h1>
        <ConnectButton />
      </div>
      <SwapForm />
      <History />
    </main>
  );
}
