import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { LoanStatusPanel } from "@/components/borrow/LoanStatusPanel";
import { OrderSummaryReadOnly } from "@/components/borrow/OrderSummaryReadOnly";
import Button from "@/components/ui/Button";
import { useBorrowSwap } from "@/context/BorrowSwapContext";
import { getOrder, getLoanOffers, type BridgeOrder } from "@/lib/amplifi-api";

type OrderPageState = {
  supplyAmountUsd: number;
  borrowAmountUsd: number;
  btcEquivalent: number;
  ltvPct: number;
  borrowSymbol?: string;
} | null;

function getButtonLabel(step: string, orderStatus: string | null): string {
  if (step && step !== "idle") {
    switch (step) {
      case "creating_order":
        return "Creating order…";
      case "creating_swap":
        return "Creating swap…";
      case "sending_btc":
        return "Sending BTC…";
      case "confirming_btc":
        return "Confirming BTC…";
      case "claiming":
        return "Claiming…";
      case "settled":
        return "Complete";
      case "error":
        return "Failed";
      default:
        return "Processing…";
    }
  }
  const s = orderStatus?.toUpperCase?.() ?? "";
  if (s === "SETTLED") return "Complete";
  if (s === "FAILED" || s === "EXPIRED" || s === "REFUNDED") return "Failed";
  if (s === "BTC_CONFIRMED" || s === "CLAIMING") return "Claiming…";
  if (s === "BTC_SENT") return "Confirming BTC…";
  if (s === "CREATED" || s === "SWAP_CREATED") return "Initiating…";
  return "Processing…";
}

export function BorrowInitiatePage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { step } = useBorrowSwap();

  const locationState = location.state as OrderPageState | undefined;
  const [order, setOrder] = useState<BridgeOrder | null>(null);
  const [summary, setSummary] = useState<OrderPageState | null>(locationState ?? null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isSendingBtc = step !== "idle" && step !== "settled" && step !== "error";

  const buildSummaryFromOrder = useCallback(async (o: BridgeOrder, cancelled: { current: boolean }) => {
    const amt = Number(o.amount) || 0;
    const btcEquivalent = amt / 1e8;
    let supplyUsd = o.amountSource ? Number(o.amountSource) : 0;
    let borrowUsd = o.amountDestination ? Number(o.amountDestination) : 0;
    let ltvPct = supplyUsd > 0 ? Math.round((borrowUsd / supplyUsd) * 100) : 50;
    if (supplyUsd <= 0 && btcEquivalent > 0) {
      try {
        const offers = await getLoanOffers({
          collateral: "WBTC",
          borrow: "USDC",
          borrowUsd: 1000,
          targetLtv: 0.5,
          limit: 1,
        });
        const q = offers.data[0]?.data?.quote;
        if (q?.requiredCollateralAmount && q.requiredCollateralAmount > 0) {
          const btcPriceUsd = q.requiredCollateralUsd / q.requiredCollateralAmount;
          supplyUsd = btcEquivalent * btcPriceUsd;
          borrowUsd = supplyUsd * (ltvPct / 100);
        }
      } catch {
        supplyUsd = btcEquivalent * 70000;
        borrowUsd = supplyUsd * 0.5;
        ltvPct = 50;
      }
    }
    if (!cancelled.current) {
      setSummary({
        supplyAmountUsd: supplyUsd || 1,
        borrowAmountUsd: borrowUsd,
        btcEquivalent,
        ltvPct,
        borrowSymbol: "USDC",
      });
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const cancelled = { current: false };
    setFetchError(null);
    getOrder(orderId)
      .then(async (res) => {
        if (cancelled.current) return;
        if (res.data) {
          setOrder(res.data);
          if (!locationState) {
            await buildSummaryFromOrder(res.data, cancelled);
          }
        }
      })
      .catch((e) => {
        if (!cancelled.current) {
          setFetchError(e instanceof Error ? e.message : "Failed to load order");
        }
      });
    return () => { cancelled.current = true; };
  }, [orderId, locationState, buildSummaryFromOrder]);

  if (!orderId || fetchError) {
    return (
      <div className="relative mx-auto w-full max-w-[1400px] min-w-0 py-6 px-4 sm:py-8 sm:px-0">
        <div className="rounded-amplifi-lg bg-white p-6">
          <p className="text-sm text-red-600">{fetchError ?? "Invalid order."}</p>
          <button
            type="button"
            onClick={() => navigate("/borrow")}
            className="mt-4 text-sm text-amplifi-primary hover:underline"
          >
            Back to borrow
          </button>
        </div>
      </div>
    );
  }

  const buttonLabel = getButtonLabel(step, order?.status ?? null);

  return (
    <div className="relative mx-auto w-full max-w-[1400px] min-w-0 py-6 px-4 sm:py-8 sm:px-0">
      <button
        type="button"
        onClick={() => navigate("/borrow")}
        className="mb-6 flex items-center gap-2 text-sm text-amplifi-muted hover:text-amplifi-text"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to borrow
      </button>

      <div className="relative grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[472px_1fr]">
        <div className="w-full min-w-0 space-y-1.5">
          {summary && (
            <>
              <OrderSummaryReadOnly
                supplyAmountUsd={summary.supplyAmountUsd}
                borrowAmountUsd={summary.borrowAmountUsd}
                btcEquivalent={summary.btcEquivalent}
                ltvPct={summary.ltvPct}
                borrowSymbol={summary.borrowSymbol}
              />
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled
              >
                {buttonLabel}
              </Button>
            </>
          )}
          {!summary && (
            <div className="rounded-amplifi bg-white p-6">
              <div className="h-32 skeleton-shimmer rounded" />
            </div>
          )}
        </div>
        <div className="w-full min-w-0">
          <div className="rounded-amplifi-lg bg-white p-4 sm:p-5 md:p-6">
            <LoanStatusPanel
              orderId={orderId}
              isSendingBtc={isSendingBtc}
              swapStep={step}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
