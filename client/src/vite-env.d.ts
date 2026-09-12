/// <reference types="vite/client" />

// ─── Ethereum provider (MetaMask / injected wallets) ────────────────────────
// These globals let us safely access window.ethereum in TypeScript.

interface EthereumRequestArguments {
  method: string;
  params?: readonly unknown[] | object;
}

interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  readonly selectedAddress?: string;
  request: (args: EthereumRequestArguments) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
  isConnected?: () => boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
