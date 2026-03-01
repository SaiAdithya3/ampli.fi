import { useEffect, useState } from "react";
import WalletConnectionModal from "@/components/ui/WalletConnectionModal";
import { PrivyStarknetSync } from "@/components/PrivyStarknetSync";
import { useWallet } from "@/store/useWallet";
import { Navbar, type TabId } from "@/components/navbar";
import { BorrowPage } from "@/components/borrow";

export default function App() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("borrow");
  const { detectProviders } = useWallet();

  useEffect(() => {
    detectProviders();
  }, [detectProviders]);

  return (
    <>
      <PrivyStarknetSync />
      <div className="min-w-0 overflow-x-hidden px-10">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenConnect={() => setModalOpen(true)}
        />

        <main className="min-h-screen bg-amplifi-surface">
          {activeTab === "borrow" && <BorrowPage />}
          {activeTab === "swap" && (
            <div className="mx-auto max-w-6xl py-8">
              <div className="rounded-2xl border border-amplifi-border bg-amplifi-surface-muted p-8 text-center text-amplifi-text">
                Swap — coming soon
              </div>
            </div>
          )}
          {activeTab === "earn" && (
            <div className="mx-auto max-w-6xl py-8">
              <div className="rounded-2xl border border-amplifi-border bg-amplifi-surface-muted p-8 text-center text-amplifi-text">
                Earn — coming soon
              </div>
            </div>
          )}
        </main>
      </div>

      <WalletConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
