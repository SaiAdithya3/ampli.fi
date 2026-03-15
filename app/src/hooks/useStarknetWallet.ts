"use client";

import {
  useConnect,
  useAccount,
  useDisconnect,
  useSwitchChain,
} from "@starknet-react/core";
import { constants } from "starknet";
import { connectors } from "@/layout/starknet/config";
import { IS_MAINNET } from "@/lib/constants";

const targetChainId = IS_MAINNET
  ? constants.StarknetChainId.SN_MAIN
  : constants.StarknetChainId.SN_SEPOLIA;

export function useStarknetWallet() {
  const { connect, connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { address, status, account, connector, chainId } = useAccount();

  const { switchChainAsync } = useSwitchChain({
    params: { chainId: targetChainId },
  });

  return {
    starknetConnect: connect,
    starknetConnectAsync: connectAsync,
    starknetConnectors: connectors,
    starknetConnector: connector,
    starknetDisconnect: disconnectAsync,
    starknetAddress: address,
    starknetStatus: status,
    starknetAccount: account,
    starknetChainId: chainId,
    starknetSwitchChain: switchChainAsync,
    targetChainId,
  };
}
