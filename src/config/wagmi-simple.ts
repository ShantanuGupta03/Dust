import { createConfig, configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { base } from 'wagmi/chains';

const { chains, provider, webSocketProvider } = configureChains(
  [base],
  [publicProvider()]
);

export const config = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: true,
        projectId: 'Ybfebeeb4c452c0b649c175fee8081a32',
      },
    }),
  ],
  provider,
  webSocketProvider,
});

export const BASE_CHAIN_ID = base.id;
export const BASE_RPC_URL = 'https://mainnet.base.org';
export const BASE_EXPLORER_URL = 'https://basescan.org';

