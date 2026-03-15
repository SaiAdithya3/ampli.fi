import { useEffect } from "react";
import { usePrivyStarknetContext } from "@/context/PrivyStarknetContext";
import { useWallet } from "@/store/useWallet";

/**
 * Syncs Privy+Starkzap wallet state to the global wallet store.
 * Uses context from PrivyStarknetProvider (single source of truth) to avoid duplicate setup.
 */
export function PrivyStarknetSync() {
  const ctx = usePrivyStarknetContext();
  const { connectPrivyStarknet, disconnectPrivyStarknet, starknetSource } =
    useWallet();

  useEffect(() => {
    if (!ctx?.isReady || !ctx?.walletAddress || !ctx?.starknetSigner) return;
    connectPrivyStarknet(ctx.walletAddress, ctx.starknetSigner);
  }, [ctx?.isReady, ctx?.walletAddress, ctx?.starknetSigner, connectPrivyStarknet]);

  useEffect(() => {
    if (!ctx) return;
    if (!ctx.isAuthenticated && starknetSource === "privy") {
      disconnectPrivyStarknet();
    }
  }, [ctx?.isAuthenticated, starknetSource, disconnectPrivyStarknet]);

  return null;
}
