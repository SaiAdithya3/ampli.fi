import { useState, useEffect } from "react";
import { Network } from "@/lib/constants";
import { WALLET_CONFIG } from "./walletConfig";
import { IS_MAINNET } from "@/lib/constants";

export type AvailableBitcoinWallet = {
  id: string;
  name: string;
  icon: string;
};

declare global {
  interface Window {
    okxwallet?: {
      bitcoin?: unknown;
      bitcoinTestnet?: unknown;
    };
    phantom?: { bitcoin?: unknown };
    keplr?: { bitcoin?: unknown };
  }
}

function updateWalletList(network: Network): AvailableBitcoinWallet[] {
  const wallets: AvailableBitcoinWallet[] = [];

  if (typeof window === "undefined") return wallets;

  if (
    window.okxwallet &&
    window.okxwallet.bitcoin &&
    window.okxwallet.bitcoinTestnet
  ) {
    wallets.push({
      id: WALLET_CONFIG.OKX.id,
      name: WALLET_CONFIG.OKX.name,
      icon: WALLET_CONFIG.OKX.icon,
    });
  }

  if (network === Network.MAINNET && window.phantom?.bitcoin) {
    wallets.push({
      id: WALLET_CONFIG.Phantom.id,
      name: WALLET_CONFIG.Phantom.name,
      icon: WALLET_CONFIG.Phantom.icon,
    });
  }

  if (window.unisat) {
    wallets.push({
      id: WALLET_CONFIG.Unisat.id,
      name: WALLET_CONFIG.Unisat.name,
      icon: WALLET_CONFIG.Unisat.icon,
    });
  }

  if (window.XverseProviders?.BitcoinProvider) {
    wallets.push({
      id: WALLET_CONFIG.Xverse.id,
      name: WALLET_CONFIG.Xverse.name,
      icon: WALLET_CONFIG.Xverse.icon,
    });
  }

  if (network === Network.MAINNET && window.keplr?.bitcoin) {
    wallets.push({
      id: WALLET_CONFIG.Keplr.id,
      name: WALLET_CONFIG.Keplr.name,
      icon: WALLET_CONFIG.Keplr.icon,
    });
  }

  return wallets;
}

export function useAvailableBitcoinWallets(): AvailableBitcoinWallet[] {
  const [availableWallets, setAvailableWallets] = useState<AvailableBitcoinWallet[]>([]);

  useEffect(() => {
    const network: Network = IS_MAINNET ? Network.MAINNET : Network.TESTNET;
    const list = updateWalletList(network);
    setAvailableWallets(list);
  }, []);

  return availableWallets;
}
