"use client";

import type { StarknetSigner } from "@atomiqlabs/chain-starknet";
import { createContext, useContext, useCallback } from "react";
import { usePrivyStarknet } from "@/hooks/usePrivyStarknet";
import { useWallet } from "@/store/useWallet";

type PrivyStarknetContextValue = {
  login: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  walletAddress: string | null;
  starknetSigner: StarknetSigner | null;
} | null;

const PrivyStarknetContext = createContext<PrivyStarknetContextValue>(null);

export function PrivyStarknetProvider({ children }: { children: React.ReactNode }) {
  const {
    logout,
    login,
    isAuthenticated,
    isReady,
    isLoading,
    error,
    walletAddress,
    starknetSigner,
  } = usePrivyStarknet();
  const { disconnectPrivyStarknet, starknetSource } = useWallet();

  const handleLogout = useCallback(async () => {
    if (starknetSource === "privy") {
      disconnectPrivyStarknet();
    }
    await logout();
  }, [logout, disconnectPrivyStarknet, starknetSource]);

  const value: PrivyStarknetContextValue = {
    login,
    logout: handleLogout,
    isAuthenticated,
    isReady,
    isLoading,
    error,
    walletAddress,
    starknetSigner,
  };

  return (
    <PrivyStarknetContext.Provider value={value}>
      {children}
    </PrivyStarknetContext.Provider>
  );
}

export function usePrivyStarknetContext(): PrivyStarknetContextValue {
  return useContext(PrivyStarknetContext);
}
