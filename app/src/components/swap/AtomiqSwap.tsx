import { useEffect, useMemo, useState } from "react";
import {
  BitcoinNetwork,
  FeeType,
  SwapperFactory,
  SpvFromBTCSwapState,
} from "@atomiqlabs/sdk";
import {
  RpcProviderWithRetries,
  StarknetInitializer,
  StarknetInitializerType,
} from "@atomiqlabs/chain-starknet";
import { useWallet } from "@/store/useWallet";
import { ASSET_ICONS, RPC_URL } from "@/lib/constants";
import type { BorrowOffer } from "@/types/borrow";
import borrowOffersData from "@/data/borrowOffers.json";

const factory = new SwapperFactory<[StarknetInitializerType]>([
  StarknetInitializer,
]);
const Tokens = factory.Tokens;

function getStarknetToken(dst: "ETH" | "STRK" | "WBTC") {
  if (dst === "ETH") return Tokens.STARKNET.ETH;
  if (dst === "WBTC") return Tokens.STARKNET._TESTNET_WBTC_VESU;
  return Tokens.STARKNET.STRK;
}

const borrowOffers = borrowOffersData as BorrowOffer[];

export function AtomiqSwap() {
  const {
    connected,
    bitcoinPaymentAddress,
    starknetAddress,
    bitcoinWalletInstance,
    starknetSigner,
  } = useWallet();

  const [amountBtc, setAmountBtc] = useState("");
  const [dstToken, setDstToken] = useState<"ETH" | "STRK" | "WBTC">("ETH");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastSwapId, setLastSwapId] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  const btcNetwork = BitcoinNetwork.TESTNET4;
  const swapper = useMemo(() => {
    const rpc = new RpcProviderWithRetries({ nodeUrl: RPC_URL });
    return factory.newSwapper({
      chains: { STARKNET: { rpcUrl: rpc } },
      bitcoinNetwork: btcNetwork,
    });
  }, [btcNetwork]);

  const log = (line: string) => {
    setLogs((l) => [...l, line]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsInitializing(true);
      try {
        await swapper.init();
        if (!cancelled) log("Swapper ready (BTC: Testnet4, Starknet: Sepolia)");
      } catch (e) {
        if (!cancelled)
          log("Init failed: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
      void swapper.stop();
    };
  }, [swapper]);

  const runSwap = async () => {
    if (
      !connected ||
      !bitcoinPaymentAddress ||
      !starknetAddress ||
      !bitcoinWalletInstance ||
      !starknetSigner
    ) {
      log("Connect both Bitcoin and Starknet wallets first.");
      return;
    }
    if (!amountBtc || Number(amountBtc) <= 0) {
      log("Enter a valid amount (BTC).");
      return;
    }

    setIsSwapping(true);
    log("Starting swap…");

    try {
      const amountSats = BigInt(Math.floor(Number(amountBtc) * 1e8));
      const token = getStarknetToken(dstToken);

      const swapLimits = swapper.getSwapLimits(Tokens.BITCOIN.BTC, token);
      log(`Limits: min ${swapLimits.input.min} – max ${swapLimits.input.max} sats`);

      log("Creating quote…");
      const swap = await swapper.swap(
        Tokens.BITCOIN.BTC,
        token,
        amountSats,
        true,
        bitcoinPaymentAddress,
        starknetAddress,
        {}
      );

      const id = swap.getId();
      setLastSwapId(id);
      log("Swap created: " + id);
      log("  Input (no fee): " + swap.getInputWithoutFee().toString() + " sats");
      log("  Fees: " + swap.getFee().amountInSrcToken.toString() + " sats");
      for (const fee of swap.getFeeBreakdown()) {
        log("    - " + FeeType[fee.type] + ": " + fee.fee.amountInSrcToken.toString() + " sats");
      }
      log("  Input (with fees): " + swap.getInput().toString() + " sats");
      log("  Output: " + swap.getOutput().toString());

      swap.events.on("swapState", (updatedSwap) => {
        const state = updatedSwap.getState();
        log("State: " + SpvFromBTCSwapState[state]);
      });

      const btcInstance = bitcoinWalletInstance as unknown as {
        publicKey?: string;
        pubkey?: string;
        getAccounts?: () => unknown;
        toBitcoinWalletAccounts?: () => unknown;
      };
      if (!btcInstance.publicKey && btcInstance.pubkey) {
        btcInstance.publicKey = btcInstance.pubkey;
      }
      if (!btcInstance.getAccounts && btcInstance.toBitcoinWalletAccounts) {
        btcInstance.getAccounts = () => btcInstance.toBitcoinWalletAccounts!();
      }

      await swap.sendBitcoinTransaction(bitcoinWalletInstance);
      log("BTC tx sent. Waiting for confirmation…");

      await swap.waitForBitcoinTransaction(undefined, 1);

      log("BTC confirmed. Waiting for claim…");
      try {
        await swap.waitTillClaimedOrFronted(AbortSignal.timeout(30_000));
        log("Claimed by watchtower.");
      } catch {
        log("Claiming manually…");
        await swap.claim(starknetSigner);
        log("Claimed manually.");
      }
      log("Swap complete.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("Error: " + msg);
      console.error("Swap error:", e);
    } finally {
      setIsSwapping(false);
    }
  };

  const canSwap =
    !isInitializing &&
    connected &&
    !!bitcoinWalletInstance &&
    !!starknetSigner &&
    !!amountBtc &&
    Number(amountBtc) > 0 &&
    !isSwapping;

  const btcEquivalent = amountBtc
    ? `≈ ${Number(amountBtc).toFixed(8)} BTC`
    : "";

  return (
    <div className="relative">
      <div className="grid gap-8 lg:grid-cols-[1fr,minmax(320px,400px)]">
        {/* Left: Swap configuration (Borrow UI style) */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amplifi-text md:text-3xl">
              Swap
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-amplifi-text">
              Swap BTC to Starknet. Deposit BTC and receive ETH, STRK, or WBTC on
              Starknet Sepolia. Connect both wallets to swap.
            </p>
          </div>

          {/* Supply / From card */}
          <div className="rounded-amplifi-lg border border-amplifi-border bg-amplifi-surface-muted p-5">
            <div className="mb-3 flex items-center gap-2">
              <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-gray-300" />
              <span className="text-sm font-medium text-amplifi-text">
                Supply
              </span>
              <svg className="h-4 w-4 text-amplifi-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-2xl font-semibold text-amplifi-text">
                  {amountBtc || "0"}
                </div>
                {btcEquivalent && (
                  <div className="text-sm text-amplifi-text">
                    {btcEquivalent}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <img src={ASSET_ICONS.BTC} alt="" className="h-8 w-8 rounded-full object-cover" />
                <span className="text-sm font-medium text-amplifi-text">BTC</span>
                <span className="text-gray-400" aria-hidden>▼</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAmountBtc("0.00005")}
                className="rounded-lg border border-amplifi-border bg-amplifi-border px-3 py-1.5 text-xs font-medium text-amplifi-text"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => setAmountBtc("0.0001")}
                className="rounded-lg border border-amplifi-border bg-amplifi-border px-3 py-1.5 text-xs font-medium text-amplifi-text"
              >
                Max
              </button>
            </div>
            <div className="mt-3">
              <label className="sr-only">Amount BTC</label>
              <input
                type="number"
                min="0"
                step="0.00000001"
                value={amountBtc}
                onChange={(e) => setAmountBtc(e.target.value)}
                placeholder="0.0001"
                className="w-full rounded-xl border border-amplifi-border bg-white px-3 py-2.5 text-sm text-amplifi-text focus:outline-none focus:ring-2 focus:ring-amplifi-primary/30"
              />
            </div>
          </div>

          {/* To / Receive card */}
          <div className="rounded-amplifi-lg border border-amplifi-border bg-amplifi-surface-muted p-5">
            <div className="mb-3 flex items-center gap-2">
              <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-gray-300" />
              <span className="text-sm font-medium text-amplifi-text">
                Receive
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-2xl font-semibold text-amplifi-text">
                {dstToken}
              </div>
              <div className="flex items-center gap-2">
                <img
                  src={dstToken === "WBTC" ? ASSET_ICONS.WBTC : ASSET_ICONS.ETH}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
                <select
                  value={dstToken}
                  onChange={(e) => setDstToken(e.target.value as "ETH" | "STRK" | "WBTC")}
                  className="rounded-lg border border-amplifi-border bg-white px-2 py-1.5 text-sm font-medium text-amplifi-text focus:outline-none focus:ring-2 focus:ring-amplifi-primary/30"
                >
                  <option value="ETH">ETH</option>
                  <option value="STRK">STRK</option>
                  <option value="WBTC">WBTC</option>
                </select>
                <span className="text-gray-400" aria-hidden>▼</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={runSwap}
            disabled={!canSwap}
            className="w-full rounded-xl bg-amplifi-primary py-3.5 text-base font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {isSwapping ? "Swapping…" : isInitializing ? "Initializing…" : "Swap"}
          </button>

          {lastSwapId && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amplifi-border bg-amplifi-surface-muted p-3">
              <span className="text-xs font-medium text-amplifi-text">
                Swap ID:
              </span>
              <span className="font-mono break-all text-xs text-amplifi-text">
                {lastSwapId}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lastSwapId);
                  log("Swap ID copied");
                }}
                className="rounded-lg bg-amplifi-primary px-2 py-1 text-xs font-medium text-white"
              >
                Copy
              </button>
            </div>
          )}

          <p className="text-xs text-amplifi-text">
            {connected ? "Wallets connected" : "Connect both wallets to swap"}
          </p>
        </div>

        {/* Right: Borrow offers */}
        <section className="rounded-amplifi-lg border border-amplifi-border bg-amplifi-surface p-5 shadow-amplifi lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-amplifi-text">
            Borrow offers
            <svg className="h-5 w-5 text-amplifi-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
          </h2>
          <ul className="space-y-0">
            {borrowOffers.map((offer) => (
              <li
                key={offer.id}
                className="flex cursor-pointer items-center gap-3 border-b border-amplifi-border py-4 last:border-b-0"
              >
                <img
                  src={offer.providerLogoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-amplifi-text">
                      {offer.providerName}
                    </span>
                    {offer.bestOffer && (
                      <span className="rounded bg-amplifi-best-offer px-1.5 py-0.5 text-xs font-medium text-amplifi-best-offer-text">
                        Best Offer
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amplifi-text">
                    <span>Net APY {offer.netApy}%</span>
                    <span>Max LTV {offer.maxLtv}%</span>
                    <span>Liquidation ${Number(offer.liquidationPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-amplifi-text">
                    <span className="flex items-center gap-1">
                      <img src={offer.collateralLogoUrl} alt="" className="h-4 w-4 rounded-full" />
                      {offer.collateralSymbol}
                    </span>
                    <span className="flex items-center gap-1">
                      <img src={offer.loanLogoUrl} alt="" className="h-4 w-4 rounded-full" />
                      {offer.loanSymbol}
                    </span>
                  </div>
                </div>
                <svg className="h-5 w-5 shrink-0 text-amplifi-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Decorative pattern (bottom-left) */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 overflow-hidden text-amplifi-primary opacity-[0.06]"
        aria-hidden
      >
        <div className="flex flex-wrap gap-4 text-4xl">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i}>→</span>
          ))}
        </div>
      </div>

      {/* Transaction logs (collapsible) */}
      <section className="mt-8 overflow-hidden rounded-amplifi-lg border border-amplifi-border bg-amplifi-surface shadow-amplifi">
        <button
          type="button"
          onClick={() => setLogsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-amplifi-text focus:outline-none"
        >
          Transaction logs
          <span className="text-xs font-normal text-amplifi-text">
            {logs.length} entries
          </span>
        </button>
        {logsOpen && (
          <div
            className="max-h-64 space-y-1 overflow-auto border-t border-amplifi-border bg-white px-4 py-3 text-xs font-mono text-amplifi-text"
            aria-live="polite"
          >
            {logs.length === 0 ? (
              <div>No logs yet. Start a swap to see details.</div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="mb-2 text-xs text-amplifi-primary underline hover:no-underline"
                >
                  Clear logs
                </button>
                {logs.map((line, i) => (
                  <div key={i} className="leading-relaxed">
                    {line}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
