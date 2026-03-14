import { FC, ReactNode } from "react";
import { StarknetConfig } from "@starknet-react/core";
import { constants as starknetConstants } from "starknet";
import {
  starknetChains,
  starknetProviders,
  connectors as starknetConnectors,
} from "./starknet/config";
import { IS_MAINNET, Network } from "@/lib/constants";

const network: Network = IS_MAINNET ? Network.MAINNET : Network.TESTNET;

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProviders: FC<WalletProviderProps> = ({ children }) => {
  return (
    <StarknetConfig
        defaultChainId={
          network === Network.MAINNET
            ? BigInt(starknetConstants.StarknetChainId.SN_MAIN)
            : BigInt(starknetConstants.StarknetChainId.SN_SEPOLIA)
        }
        chains={starknetChains}
        provider={starknetProviders}
        connectors={starknetConnectors}
        autoConnect
      >
        {children}
      </StarknetConfig>
  );
};
