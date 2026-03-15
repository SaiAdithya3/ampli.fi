import { useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { StarknetSigner } from "@atomiqlabs/chain-starknet";
import type { Account } from "starknet";
import { useWallet } from "@/store/useWallet";

/**
 * Syncs @starknet-react/core connection state to useWallet.
 * When user connects via Starknet extension (Argent, Braavos, etc.),
 * we derive StarknetSigner and update the global wallet store.
 * No WalletReconnector needed - @starknet-react/core autoConnect handles reconnect.
 */
export function StarknetSync() {
  const { address, status, account, connector } = useAccount();
  const {
    starknetAddress,
    starknetSource,
    connectStarknetFromExtension,
    disconnectStarknetFromExtension,
  } = useWallet();

  useEffect(() => {
    if (status === "connected" && address && account && connector) {
      try {
        const signer = new StarknetSigner(account as Account);
        connectStarknetFromExtension(address, signer, account, connector.name);
      } catch (e) {
        console.warn("[StarknetSync] Failed to create signer:", e);
      }
    } else if (status === "disconnected" || status === "idle") {
      if (starknetAddress && starknetSource === "extension") {
        disconnectStarknetFromExtension();
      }
    }
  }, [status, address, account, connector, starknetAddress, starknetSource]);

  return null;
}
