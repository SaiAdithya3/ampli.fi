import { braavos, injected, legacyInjected, ready, type Connector } from "@starknet-react/core";
import { mainnet, sepolia } from "@starknet-react/chains";
import { isInArgentMobileAppBrowser } from "starknetkit/argentMobile";
import { isInBraavosMobileAppBrowser } from "starknetkit/braavosMobile";
import { RpcProvider } from "starknet";
import { Network } from "@/lib/constants";
import { IS_MAINNET, RPC_URL } from "@/lib/constants";

const network: Network = IS_MAINNET ? Network.MAINNET : Network.TESTNET;

export const availableConnectors = () => {
  if (isInArgentMobileAppBrowser()) {
    return [ready()];
  }

  if (isInBraavosMobileAppBrowser()) {
    return [braavos()];
  }

  return [
    ready(),
    braavos(),
    injected({ id: "keplr" }),
    injected({ id: "xverse" }),
    legacyInjected({ id: "okxwallet" }),
  ].filter((connector) => connector !== null);
};

type ConnectorWithSwitch = Connector & { switchChain?: (...args: unknown[]) => Promise<unknown> };

function patchConnectors(connectors: Connector[]): Connector[] {
  for (const connector of connectors) {
    const obj = connector as unknown as Record<string, unknown>;
    const originalSwitch = (connector as ConnectorWithSwitch).switchChain?.bind(connector);
    if (originalSwitch) {
      obj.switchChain = async (...args: unknown[]) => {
        try {
          return await originalSwitch(...args);
        } catch (e) {
          console.warn(
            `[starknet] switchChain not supported by wallet, skipping:`,
            e
          );
        }
      };
    }
    const originalReady = connector.ready?.bind(connector);
    if (originalReady) {
      obj.ready = async () => {
        for (let i = 0; i < 20; i++) {
          if (connector.available?.()) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        if (!connector.available?.()) return false;
        try {
          const result = await originalReady();
          return result || true;
        } catch {
          return true;
        }
      };
    }
  }
  return connectors;
}

export const connectors = patchConnectors(availableConnectors());

export const starknetChains = [mainnet, sepolia];

const createStarknetProvider = () => {
  return () => {
    const nodeUrl = RPC_URL || (network === Network.MAINNET
      ? "https://starknet-mainnet.public.blastapi.io"
      : "https://starknet-sepolia.public.blastapi.io");
    return new RpcProvider({ nodeUrl });
  };
};

export const starknetProviders = createStarknetProvider();
