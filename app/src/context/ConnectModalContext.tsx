"use client";

import { createContext, useContext, useState, useCallback } from "react";

export type ConnectModalView = "choose" | "bitcoin" | "starknet";

type ConnectModalContextValue = {
  isOpen: boolean;
  initialView: ConnectModalView | null;
  open: (view?: "bitcoin" | "starknet") => void;
  close: () => void;
};

const ConnectModalContext = createContext<ConnectModalContextValue | null>(null);

export function ConnectModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialView, setInitialView] = useState<ConnectModalView | null>(null);

  const open = useCallback((view?: "bitcoin" | "starknet") => {
    setInitialView(view ?? "choose");
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialView(null);
  }, []);

  return (
    <ConnectModalContext.Provider value={{ isOpen, initialView, open, close }}>
      {children}
    </ConnectModalContext.Provider>
  );
}

export function useConnectModal(): ConnectModalContextValue {
  const ctx = useContext(ConnectModalContext);
  if (!ctx) {
    throw new Error("useConnectModal must be used within ConnectModalProvider");
  }
  return ctx;
}
