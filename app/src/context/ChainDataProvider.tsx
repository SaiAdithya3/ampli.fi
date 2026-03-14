import { useMemo } from "react";
import { ChainDataContext } from "./ChainDataContext";
import { useWallet } from "@/store/useWallet";
import { useConnectModal } from "./ConnectModalContext";

export function ChainDataProvider({ children }: { children: React.ReactNode }) {
  const { starknetAccount, starknetWalletName } = useWallet();
  const { open } = useConnectModal();

  const contextValue = useMemo(() => {
    return {
      STARKNET: starknetAccount
        ? {
            chain: {
              name: "Starknet",
              icon: "/logos/protocol.svg",
            },
            wallet: {
              name: starknetWalletName || "Starknet Wallet",
              icon: "/logos/wallet.svg",
              address: starknetAccount.address,
              instance: starknetAccount,
            },
            id: "STARKNET",
            connect: open,
          }
        : undefined,
    };
  }, [starknetAccount, starknetWalletName, open]);

  return (
    <ChainDataContext.Provider value={contextValue}>
      {children}
    </ChainDataContext.Provider>
  );
}
