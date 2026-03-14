import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import WalletConnectionModal from "@/components/ui/WalletConnectionModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PrivyStarknetSync } from "@/components/PrivyStarknetSync";
import { StarknetSync } from "@/components/StarknetSync";
import { Navbar } from "@/components/navbar";
import { ChainDataProvider } from "@/context/ChainDataProvider";
import { ConnectModalProvider, useConnectModal } from "@/context/ConnectModalContext";
import {
  BorrowLayout,
  BorrowHomePage,
  BorrowOfferPage,
  BorrowInitiatePage,
} from "@/pages/borrow";
import { HistoryPage, OrderDetailPage } from "@/pages/history";
import { SwapPage } from "@/pages/swap";
import { EarnPage } from "@/components/earn";

function AppContent() {
  const { isOpen, initialView, open, close } = useConnectModal();

  return (
    <>
      <StarknetSync />
      <PrivyStarknetSync />
      <div className="flex h-screen min-h-0 flex-col min-w-0 overflow-x-hidden px-4 sm:px-6 lg:px-10">
        <Navbar onOpenConnect={open} />

        <main className="min-h-0 flex-1 overflow-auto bg-amplifi-surface">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Navigate to="/borrow" replace />} />
              <Route path="/borrow" element={<BorrowLayout />}>
                <Route index element={<BorrowHomePage />} />
                <Route path="offer" element={<BorrowOfferPage />} />
                <Route path="initiate/:orderId" element={<BorrowInitiatePage />} />
                <Route path="order/:orderId" element={<BorrowInitiatePage />} />
              </Route>
              <Route path="/earn" element={<EarnPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:orderId" element={<OrderDetailPage />} />
              <Route path="/swap" element={<SwapPage />} />
              <Route path="*" element={<Navigate to="/borrow" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>

      <WalletConnectionModal isOpen={isOpen} onClose={close} initialView={initialView} />
    </>
  );
}

function AppWithConnectModal() {
  return (
    <ConnectModalProvider>
      <ChainDataProvider>
        <AppContent />
      </ChainDataProvider>
    </ConnectModalProvider>
  );
}

export default function App() {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <BrowserRouter>
        <AppWithConnectModal />
      </BrowserRouter>
    </TooltipPrimitive.Provider>
  );
}
