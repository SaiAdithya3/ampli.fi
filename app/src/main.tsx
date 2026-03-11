import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@/components/providers/PrivyProvider";
import { patchRpcCache } from "@/lib/atomiq/rpcCache";
import { RPC_URL } from "@/lib/constants";
import App from "./App";
import "./index.css";

// Reduce duplicate RPC calls from Atomiq SDK event poller (getEvents, getBlockWithTxHashes)
if (RPC_URL) patchRpcCache(RPC_URL);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider>
      <App />
    </PrivyProvider>
  </StrictMode>
);
