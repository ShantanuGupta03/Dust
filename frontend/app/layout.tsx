import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import { ReactNode } from 'react';
import Providers from './providers';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="min-h-screen bg-neutral-950 text-neutral-100">
            <div className="max-w-4xl mx-auto p-4">{children}</div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
