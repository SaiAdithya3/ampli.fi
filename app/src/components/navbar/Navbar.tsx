import { LOGOS } from "@/lib/constants";
import { useWallet } from "@/store/useWallet";

export type TabId = "borrow" | "earn" | "swap";

const TABS: { id: TabId; label: string }[] = [
  { id: "borrow", label: "Borrow" },
  { id: "earn", label: "Earn" },
  { id: "swap", label: "Swap" },
];

function short(addr?: string | null, leading = 6, trailing = 4) {
  if (!addr) return "";
  if (addr.length <= leading + trailing + 3) return addr;
  return `${addr.slice(0, leading)}...${addr.slice(-trailing)}`;
}

interface NavbarProps {
  activeTab: TabId;
  setActiveTab: (id: TabId) => void;
  onOpenConnect: () => void;
}

export function Navbar({ activeTab, setActiveTab, onOpenConnect }: NavbarProps) {
  const { isConnecting, connected, bitcoinPaymentAddress, starknetAddress } =
    useWallet();
  const displayAddress = bitcoinPaymentAddress || starknetAddress;

  return (
    <header className="py-8">
      <div className="mx-auto flex items-center justify-between gap-4">
        {/* Left: brand + nav items next to logo */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <img
              src={LOGOS.brand}
              alt="amplify"
              aria-hidden
            />
          </div>
          <nav className="flex items-center gap-2.5">
            {TABS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={
                    isActive
                      ? "flex items-center justify-center gap-2.5 rounded-[10px] bg-amplifi-nav px-5 py-3 text-sm font-medium text-white transition-colors"
                      : "flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-medium text-amplifi-text transition-colors hover:text-amplifi-text"
                  }
                >
                  {label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Connect Wallet */}
        <div className="flex items-center gap-2.5">
          {!connected ? (
            <button
              type="button"
              onClick={onOpenConnect}
              disabled={isConnecting}
              className="inline-flex items-center justify-center gap-2.5 rounded-[10px] bg-amplifi-nav px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            >
              <img
                src={LOGOS.wallet}
                alt=""
                className="h-5 w-5"
                aria-hidden
              />
              {isConnecting ? "Connecting…" : "Connect Wallet"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenConnect}
              className="rounded-[10px] border border-amplifi-border bg-amplifi-surface px-5 py-3 text-sm font-medium text-amplifi-text transition-colors hover:opacity-90"
            >
              {short(displayAddress)}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
