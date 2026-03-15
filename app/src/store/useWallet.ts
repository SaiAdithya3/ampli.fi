import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BitcoinNetwork } from "@atomiqlabs/sdk";
import { StarknetSigner } from "@atomiqlabs/chain-starknet";
import { AccountInterface } from "starknet";
import { XverseBitcoinWallet } from "@/lib/bitcoin/XverseBitcoinWallet";
import { UnisatBitcoinWallet } from "@/lib/bitcoin/UnisatBitcoinWallet";

import { API_URL, IS_MAINNET } from "@/lib/constants";
const BITCOIN_NETWORK = IS_MAINNET ? BitcoinNetwork.MAINNET : BitcoinNetwork.TESTNET4;
const BITCOIN_RPC_URL = `${API_URL}/api/mempool/`;

type BitcoinWalletInstance =
  | XverseBitcoinWallet
  | UnisatBitcoinWallet
  | null;

export type StarknetSource = "extension" | "privy" | null;

type WalletState = {
  isConnecting: boolean;
  connected: boolean;
  bitcoinPaymentAddress: string | null;
  starknetAddress: string | null;
  bitcoinWalletType: "xverse" | "unisat" | null;
  starknetWalletName: string | null;
  starknetSource: StarknetSource;
  /** Live instances for swap (not persisted). */
  bitcoinWalletInstance: BitcoinWalletInstance;
  starknetSigner: StarknetSigner | null;
  /** Raw Starknet account for earn/staking (starkzap); set when connecting via extension. */
  starknetAccount: AccountInterface | null;

  connectBitcoin: (walletId: string) => Promise<void>;
  /** Called by PrivyStarknetSync when Privy wallet is ready. */
  connectPrivyStarknet: (address: string, signer: StarknetSigner) => void;
  /** Called by StarknetSync when @starknet-react/core reports connected. */
  connectStarknetFromExtension: (
    address: string,
    signer: StarknetSigner,
    account: AccountInterface,
    walletName: string
  ) => void;
  /** Called by StarknetSync when @starknet-react/core reports disconnected. */
  disconnectStarknetFromExtension: () => void;
  /** Called when user logs out of Privy. */
  disconnectPrivyStarknet: () => void;
  disconnectBitcoin: () => void;
  /** Reconnect Bitcoin when we have persisted type but missing instance. */
  reconnectWallets: () => Promise<void>;
};

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      isConnecting: false,
      connected: false,
      bitcoinPaymentAddress: null,
      starknetAddress: null,
      bitcoinWalletType: null,
      starknetWalletName: null,
      starknetSource: null,
      bitcoinWalletInstance: null,
      starknetSigner: null,
      starknetAccount: null,

      connectBitcoin: async (walletId: string) => {
        const current = get();
        if (current.isConnecting) return;
        if (current.bitcoinWalletInstance && current.bitcoinPaymentAddress) return;
        if (walletId !== "xverse" && walletId !== "unisat") {
          throw new Error("This wallet is not yet supported for swap");
        }

        try {
          set({ isConnecting: true });

          const wallet =
            walletId === "xverse"
              ? await XverseBitcoinWallet.connect(
                  BITCOIN_NETWORK,
                  BITCOIN_RPC_URL
                )
              : await UnisatBitcoinWallet.connect(
                  BITCOIN_NETWORK,
                  BITCOIN_RPC_URL
                );

          const address = wallet.getReceiveAddress();
          set({
            bitcoinPaymentAddress: address,
            bitcoinWalletType: walletId,
            bitcoinWalletInstance: wallet,
            connected: true,
            isConnecting: false,
          });
        } catch (error) {
          console.error(`Failed to connect ${walletId}:`, error);
          set({ isConnecting: false });
          throw error;
        }
      },

      connectPrivyStarknet: (address, signer) => {
        set({
          starknetAddress: address,
          starknetWalletName: "Privy",
          starknetSource: "privy",
          starknetSigner: signer,
          starknetAccount: null,
          connected: true,
        });
      },

      connectStarknetFromExtension: (address, signer, account, walletName) => {
        set({
          starknetAddress: address,
          starknetWalletName: walletName,
          starknetSource: "extension",
          starknetSigner: signer,
          starknetAccount: account,
          connected: true,
        });
      },

      disconnectStarknetFromExtension: () => {
        if (get().starknetSource === "privy") return;
        set({
          starknetAddress: null,
          starknetWalletName: null,
          starknetSource: null,
          starknetSigner: null,
          starknetAccount: null,
          connected: Boolean(get().bitcoinPaymentAddress),
        });
      },

      disconnectPrivyStarknet: () => {
        if (get().starknetSource !== "privy") return;
        set({
          starknetAddress: null,
          starknetWalletName: null,
          starknetSource: null,
          starknetSigner: null,
          starknetAccount: null,
          connected: Boolean(get().bitcoinPaymentAddress),
        });
      },

      disconnectBitcoin: () => {
        set({
          bitcoinPaymentAddress: null,
          bitcoinWalletType: null,
          bitcoinWalletInstance: null,
          connected: Boolean(get().starknetAddress),
        });
      },

      reconnectWallets: async () => {
        const s = get();
        if (s.bitcoinWalletType && !s.bitcoinWalletInstance) {
          try {
            await get().connectBitcoin(s.bitcoinWalletType);
          } catch (e) {
            console.warn("[reconnectWallets] Bitcoin reconnect failed:", e);
          }
        }
        // Starknet: @starknet-react/core autoConnect handles reconnect; no need to retry here
      },
    }),
    {
      name: "amplifi-wallet",
      partialize: (state) => ({
        bitcoinPaymentAddress: state.bitcoinPaymentAddress,
        bitcoinWalletType: state.bitcoinWalletType,
        connected: state.connected,
      }),
      onRehydrateStorage: () => (state, err) => {
        if (err) {
          console.warn("[useWallet] Rehydration error:", err);
          return;
        }
        if (typeof window === "undefined" || !state) return;
        setTimeout(() => {
          const store = useWallet.getState();
          if (store.bitcoinWalletType && !store.bitcoinWalletInstance) {
            store.connectBitcoin(store.bitcoinWalletType).catch((e) => {
              console.warn("[useWallet] Rehydrate BTC connect failed:", e);
            });
          }
          // Starknet: @starknet-react/core autoConnect handles reconnect
        }, 0);
      },
    }
  )
);
