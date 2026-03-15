import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@/store/useWallet";
import { useStarknetWallet } from "@/hooks/useStarknetWallet";
import { useAvailableBitcoinWallets } from "@/lib/bitcoin/useAvailableBitcoinWallets";
import { usePrivyStarknetContext } from "@/context/PrivyStarknetContext";
import { WALLET_ICONS, ASSET_ICONS } from "@/lib/constants";
import type { ConnectModalView } from "@/context/ConnectModalContext";

const SUPPORTED_BTC_WALLET_IDS = new Set(["xverse", "unisat"]);
const DRAG_CLOSE_THRESHOLD = 80;

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: ConnectModalView | null;
}

export default function WalletConnectionModal({
  isOpen,
  onClose,
  initialView: initialViewProp,
}: WalletConnectionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ConnectModalView>("choose");
  const {
    bitcoinPaymentAddress,
    starknetAddress,
    starknetSource,
    connected,
    connectBitcoin,
    disconnectBitcoin,
    disconnectPrivyStarknet,
    isConnecting,
  } = useWallet();

  const privyContext = usePrivyStarknetContext();

  const availableBitcoinWallets = useAvailableBitcoinWallets();

  const {
    starknetConnectors,
    starknetConnector,
    starknetStatus,
    starknetConnectAsync,
    starknetDisconnect,
  } = useStarknetWallet();

  const [connectingBtcId, setConnectingBtcId] = useState<string | null>(null);
  const [connectingStarknetId, setConnectingStarknetId] = useState<string | null>(null);
  const [disconnectingAll, setDisconnectingAll] = useState(false);
  const [btcConnectError, setBtcConnectError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef(0);
  const dragOffsetRef = useRef(0);
  dragOffsetRef.current = dragOffset;

  useEffect(() => {
    setMounted(typeof document !== "undefined");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Set view when modal opens (use initialView if provided, else "choose")
  useEffect(() => {
    if (isOpen) {
      setView(initialViewProp && initialViewProp !== "choose" ? initialViewProp : "choose");
      setBtcConnectError(null);
      setDragOffset(0);
    }
  }, [isOpen, initialViewProp]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return;
      dragStartY.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isMobile]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isMobile) return;
      const delta = e.clientY - dragStartY.current;
      if (delta > 0) setDragOffset(delta);
    },
    [isMobile]
  );

  const handlePointerUp = useCallback(() => {
    if (dragOffsetRef.current >= DRAG_CLOSE_THRESHOLD) {
      onClose();
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view !== "choose") setView("choose");
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, view]);

  const onBitcoinConnect = async (walletId: string) => {
    setBtcConnectError(null);
    setConnectingBtcId(walletId);
    try {
      await connectBitcoin(walletId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(e);
      setBtcConnectError(msg);
    } finally {
      setConnectingBtcId(null);
    }
  };

  const onStarknetConnect = async (connectorId: string) => {
    const connector = starknetConnectors.find(
      (c) => (c as { id?: string; name?: string }).id === connectorId ||
        (c as { id?: string; name?: string }).name?.toLowerCase() === connectorId.toLowerCase()
    );
    if (!connector) return;
    const c = connector as { id?: string; name?: string };
    setConnectingStarknetId(c.id ?? c.name ?? connectorId);
    try {
      await starknetConnectAsync({ connector });
    } catch (e) {
      console.error(e);
    } finally {
      setConnectingStarknetId(null);
    }
  };

  const onStarknetDisconnect = async () => {
    try {
      if (starknetSource === "privy" && privyContext) {
        disconnectPrivyStarknet();
        await privyContext.logout();
      } else {
        await starknetDisconnect();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onDisconnectAll = async () => {
    setDisconnectingAll(true);
    try {
      if (bitcoinPaymentAddress) disconnectBitcoin();
      if (starknetAddress) await onStarknetDisconnect();
    } catch (e) {
      console.error(e);
    } finally {
      setDisconnectingAll(false);
    }
  };

  if (!isOpen) return null;

  const renderHeader = () => (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {view !== "choose" && (
          <button
            type="button"
            onClick={() => setView("choose")}
            className="rounded p-1.5 text-amplifi-text transition-colors hover:bg-gray-100"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 id="connect-wallets-title" className="text-lg font-semibold text-amplifi-text">
          {view === "choose" && "Connect Wallets"}
          {view === "bitcoin" && "Connect Bitcoin"}
          {view === "starknet" && "Connect Starknet"}
        </h2>
      </div>
      {!isMobile && (
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-amplifi-text transition-colors hover:bg-gray-100"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const renderChooseView = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => setView("bitcoin")}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-amplifi-border bg-amplifi-surface md:p-8 p-4 transition-colors hover:bg-gray-50"
      >
        <img
          src={ASSET_ICONS.BTC}
          alt=""
          className="h-10 w-10 shrink-0 object-contain"
        />
        <span className="flex items-center gap-1 text-xs font-medium text-amplifi-text">
          {bitcoinPaymentAddress ? "Connected" : "Connect Bitcoin"}
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
        {bitcoinPaymentAddress && (
          <span className="text-[10px] text-green-600 truncate max-w-full px-1">
            {bitcoinPaymentAddress.slice(0, 6)}...{bitcoinPaymentAddress.slice(-4)}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setView("starknet")}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-amplifi-border bg-amplifi-surface md:p-8 p-4 transition-colors hover:bg-gray-50"
      >
        <img
          src={ASSET_ICONS.STRK}
          alt=""
          className="h-10 w-10 shrink-0 object-contain"
        />
        <span className="flex items-center gap-1 text-xs font-medium text-amplifi-text">
          {starknetAddress ? "Connected" : "Connect Starknet"}
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
        {starknetAddress && (
          <span className="text-[10px] text-green-600 truncate max-w-full px-1">
            {starknetAddress.slice(0, 6)}...{starknetAddress.slice(-4)}
          </span>
        )}
      </button>
    </div>
  );

  const renderBitcoinView = () => (
    <div className="space-y-3">
      {bitcoinPaymentAddress ? (
        <div className="rounded-lg border border-amplifi-border p-3">
          <div className="mb-1 text-xs text-amplifi-text">Connected</div>
          <div className="break-all rounded bg-gray-100 p-2 text-xs font-mono text-amplifi-text">
            {bitcoinPaymentAddress}
          </div>
          <button
            type="button"
            onClick={() => disconnectBitcoin()}
            className="mt-2 text-xs text-red-600 hover:underline"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {availableBitcoinWallets
            .filter((wallet) => SUPPORTED_BTC_WALLET_IDS.has(wallet.id))
            .map((wallet) => {
            const isConnectingThis = connectingBtcId === wallet.id;

            return (
              <button
                key={wallet.id}
                type="button"
                onClick={() => onBitcoinConnect(wallet.id)}
                disabled={isConnectingThis || isConnecting}
                className="flex w-full items-center gap-3 rounded-lg border border-amplifi-border bg-amplifi-surface px-4 py-3 text-left transition-colors disabled:opacity-50"
              >
                <img src={wallet.icon} alt="" className="h-6 w-6" />
                <span className="flex-1">
                  {isConnectingThis ? "Connecting…" : wallet.name}
                </span>
              </button>
            );
          })}
          {availableBitcoinWallets.filter((w) => SUPPORTED_BTC_WALLET_IDS.has(w.id)).length === 0 && (
            <p className="py-2 text-xs text-amplifi-text">No Bitcoin wallet detected</p>
          )}
          {btcConnectError && <p className="text-xs text-red-600">{btcConnectError}</p>}
        </div>
      )}
    </div>
  );

  const renderStarknetView = () => (
    <div className="space-y-3">
      {starknetAddress ? (
        <div className="rounded-lg border border-amplifi-border p-3">
          <div className="mb-1 text-xs text-amplifi-text">Connected</div>
          <div className="break-all rounded bg-gray-100 p-2 text-xs font-mono text-amplifi-text">
            {starknetAddress}
          </div>
          <button
            type="button"
            onClick={() => onStarknetDisconnect()}
            className="mt-2 text-xs text-red-600 hover:underline"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {starknetConnectors.map((connector) => {
            const c = connector as { id?: string; name?: string; available?: () => boolean };
            const name = c.name ?? c.id ?? "Unknown";
            const logo = WALLET_ICONS[c.id as keyof typeof WALLET_ICONS] ?? "https://ik.imagekit.io/thecirclecompany/chains/starknet.svg";
            const isConnected = starknetStatus === "connected" && (starknetConnector as { id?: string } | null)?.id === c.id;
            const isConnectingThis = connectingStarknetId === (c.id ?? c.name);

            return (
              <button
                key={c.id ?? name}
                type="button"
                onClick={() => onStarknetConnect(c.id ?? name)}
                disabled={isConnectingThis || isConnecting || !c.available?.()}
                className="flex w-full items-center gap-3 rounded-lg border border-amplifi-border bg-amplifi-surface px-4 py-3 text-left transition-colors disabled:opacity-50"
              >
                <img src={logo} alt="" className="h-6 w-6" />
                <span className="flex-1">
                  {isConnectingThis ? "Connecting…" : name}
                </span>
                {isConnected && (
                  <span className="text-xs text-green-600">Connected</span>
                )}
              </button>
            );
          })}
          {privyContext && (
            <button
              type="button"
              onClick={() => privyContext.login()}
              disabled={privyContext.isLoading || isConnecting}
              className="flex w-full items-center gap-3 rounded-lg border border-amplifi-border bg-amplifi-surface px-4 py-3 text-left transition-colors disabled:opacity-50"
            >
              <img src={WALLET_ICONS.privy} alt="" className="h-6 w-6" />
              <span className="flex-1">
                {privyContext.isLoading ? "Connecting…" : "Privy (Email / Social)"}
              </span>
            </button>
          )}
          {privyContext?.error && (
            <p className="text-xs text-red-600">{privyContext.error}</p>
          )}
        </div>
      )}
    </div>
  );

  const sheetContent = (
    <>
      {isMobile && (
        <div
          className="flex shrink-0 justify-center pt-3 pb-2 touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="button"
          tabIndex={0}
          aria-label="Drag to close"
        >
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
      )}
      {renderHeader()}
      {view === "choose" && renderChooseView()}
      {view === "bitcoin" && renderBitcoinView()}
      {view === "starknet" && renderStarknetView()}
      <div className="mt-4 text-xs text-amplifi-text">
        {bitcoinPaymentAddress && starknetAddress
          ? "Both wallets connected"
          : "Connect both wallets to use swap"}
      </div>
      {connected && (
        <button
          type="button"
          onClick={onDisconnectAll}
          disabled={disconnectingAll || (!bitcoinPaymentAddress && !starknetAddress)}
          className="mt-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {disconnectingAll ? "Disconnecting…" : "Disconnect All"}
        </button>
      )}
    </>
  );

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-wallets-title"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex w-full max-w-lg flex-col overflow-y-auto border border-amplifi-border bg-amplifi-surface shadow-amplifi ${
          isMobile ? "max-h-[70vh] rounded-t-xl border-b-0 px-6 pb-6" : "rounded-amplifi p-6"
        }`}
        style={
          isMobile
            ? {
                transform: `translateY(${dragOffset}px)`,
                transition: dragOffset === 0 ? "transform 0.2s ease-out" : "none",
              }
            : undefined
        }
        onClick={(e) => e.stopPropagation()}
      >
        {sheetContent}
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
