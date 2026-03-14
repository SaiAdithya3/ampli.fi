import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { PrivyStarknetProvider } from "@/context/PrivyStarknetContext";
import { WalletProviders } from "@/layout/WalletProviders";
import { patchRpcCache } from "@/lib/atomiq/rpcCache";
import { RPC_URL } from "@/lib/constants";
import App from "./App";
import "./index.css";

// Reduce duplicate RPC calls from Atomiq SDK event poller (getEvents, getBlockWithTxHashes)
if (RPC_URL) patchRpcCache(RPC_URL);

const hasPrivy = !!import.meta.env.VITE_PRIVY_APP_ID;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider>
      <WalletProviders>
        {hasPrivy ? (
          <PrivyStarknetProvider>
            <App />
          </PrivyStarknetProvider>
        ) : (
          <App />
        )}
      </WalletProviders>
    </PrivyProvider>
  </StrictMode>
);
