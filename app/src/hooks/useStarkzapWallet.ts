import { useCallback, useContext } from "react";
import type { WalletInterface } from "starkzap";
import { ChainDataContext } from "@/context/ChainDataContext";
import { InjectedStarkzapWallet } from "@/lib/staking/InjectedStarkzapWallet";
import { useWallet } from "@/store/useWallet";

/**
 * Returns a getter for the current Starkzap wallet used for Earn (balance + stake).
 * Uses extension wallet (Argent, Braavos, etc.) from @starknet-react/core.
 */
export function useStarkzapWallet() {
  const chainData = useContext(ChainDataContext);
  const extensionAccount = chainData.STARKNET?.wallet?.instance;

  return useCallback(async (): Promise<WalletInterface> => {
    if (extensionAccount) {
      return InjectedStarkzapWallet.fromAccount(extensionAccount as never) as unknown as WalletInterface;
    }
    throw new Error("Connect your Starknet wallet to continue");
  }, [extensionAccount]);
}
