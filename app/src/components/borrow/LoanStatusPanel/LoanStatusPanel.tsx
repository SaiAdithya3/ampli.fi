import { useEffect, useState } from "react";
import { getBridgeOrder, type BridgeOrderDetail, type BridgeOrderPayment } from "@/lib/amplifi-api";
import { LOGOS } from "@/lib/constants";

const POLL_INTERVAL_MS = 3000;
const SATS_PER_BTC = 100_000_000;

const STEPS = [
  { id: 1, label: "Order Created" },
  { id: 2, label: "Detecting BTC Deposit" },
  { id: 3, label: "Collateral conversion & allocation" },
  { id: 4, label: "Loan issued" },
  { id: 5, label: "Position Active" },
] as const;

/** Maps bridge order status to the active step (1-based). */
function statusToStep(status: string): number {
  const s = status?.toUpperCase?.() ?? "";
  if (s === "CREATED" || s === "AWAITING_USER_SIGNATURE") return 2;
  if (s === "SOURCE_SUBMITTED") return 3;
  if (s === "SOURCE_CONFIRMED") return 3;
  if (s === "SETTLED") return 5;
  return 2;
}

export interface LoanFlowState {
  orderId: string;
  status: string;
  depositAddress?: string;
  amountSats?: string;
  error?: string;
}

export interface LoanStatusPanelProps {
  orderId: string;
  depositAddress?: string;
  amountSats?: string;
  /** PSBT flow: when present, user must sign this PSBT */
  payment?: BridgeOrderPayment;
  isSendingBtc?: boolean;
  /** Called when user clicks Sign for PSBT flow */
  onSignPsbt?: (orderId: string, payment: Extract<BridgeOrderPayment, { type: "FUNDED_PSBT" } | { type: "RAW_PSBT" }>) => void;
  onStatusChange?: (state: LoanFlowState) => void;
}

export function LoanStatusPanel({
  orderId,
  depositAddress: initialDepositAddress,
  amountSats: initialAmountSats,
  payment,
  isSendingBtc,
  onSignPsbt,
  onStatusChange,
}: LoanStatusPanelProps) {
  const [order, setOrder] = useState<BridgeOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled || !orderId) return;
      try {
        const res = await getBridgeOrder(orderId);
        const detail: BridgeOrderDetail | null =
          (res as { data?: BridgeOrderDetail }).data ??
          (typeof (res as BridgeOrderDetail).status === "string" ? (res as BridgeOrderDetail) : null);

        if (cancelled) return;
        if (detail && !Array.isArray(detail)) {
          setOrder(detail);
          setError(detail.error ?? null);
          onStatusChange?.({
            orderId,
            status: detail.status,
            depositAddress: detail.quote?.depositAddress ?? initialDepositAddress,
            amountSats: detail.quote?.amountIn ?? initialAmountSats,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch status");
      }
      if (!cancelled)
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [orderId, initialDepositAddress, initialAmountSats, onStatusChange]);

  const status = order?.status ?? "CREATED";
  const activeStep = statusToStep(status);
  const depositAddress = order?.quote?.depositAddress ?? initialDepositAddress;
  const amountSats = order?.quote?.amountIn ?? initialAmountSats;
  const amountBtc = amountSats ? (parseInt(amountSats, 10) / SATS_PER_BTC).toFixed(8) : null;

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-2 text-base text-amplifi-text">
        <img src={LOGOS.status} alt="status" className="h-5 w-5 text-amplifi-muted" />
        Loan status
      </div>
      <ol className="space-y-3">
        {STEPS.map((step) => {
          const isComplete = step.id < activeStep;
          const isActive = step.id === activeStep;
          const showLoading =
            isActive &&
            (isSendingBtc || status === "CREATED" || status === "AWAITING_USER_SIGNATURE");

          const stepNumberBg = isComplete
            ? "bg-[#F3FDF6]"
            : isActive
              ? "bg-[#00CD3B]"
              : "bg-[#FAFAFA]";
          const stepNumberText = isActive
            ? "text-white"
            : isComplete
              ? "text-[#033122]"
              : "text-[#8A8A8A]";
          const stepNameColor = isActive ? "text-[#033122]" : "text-[#8A8A8A]";

          return (
            <li
              key={step.id}
              className="flex items-center gap-3"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-sm font-semibold ${stepNumberBg} ${stepNumberText}`}
              >
                {step.id}
              </div>
              <span
                className={`text-xl font-medium ${stepNameColor}`}
              >
                {step.label}
              </span>
              {showLoading && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00CD3B]">
                  <img
                    src={LOGOS.loading}
                    alt=""
                    className="h-8 w-8 animate-spin"
                    aria-hidden
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {(depositAddress || payment) && amountBtc && activeStep <= 2 && (
        <div className="mt-4 rounded-lg border border-amplifi-border bg-amplifi-surface-muted/50 p-4 text-sm">
          <p className="mb-2 font-medium text-amplifi-text">
            {payment && (payment.type === "FUNDED_PSBT" || payment.type === "RAW_PSBT")
              ? isSendingBtc
                ? "Sign the transaction in your Bitcoin wallet"
                : "Sign the transaction in your Bitcoin wallet to complete your deposit"
              : isSendingBtc
                ? "Sign the transaction in your Bitcoin wallet to send the deposit"
                : "Send BTC to complete your deposit"}
          </p>
          <p className="mb-1 text-amplifi-muted">Amount: {amountBtc} BTC</p>
          {depositAddress ? (
            <p className="break-all font-mono text-xs text-amplifi-text">{depositAddress}</p>
          ) : payment && (payment.type === "FUNDED_PSBT" || payment.type === "RAW_PSBT") && onSignPsbt ? (
            <button
              type="button"
              disabled={isSendingBtc}
              onClick={() => onSignPsbt(orderId, payment)}
              className="mt-2 rounded-lg bg-amplifi-primary px-4 py-2 text-sm font-medium text-white hover:bg-amplifi-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingBtc ? "Signing…" : "Sign with Bitcoin wallet"}
            </button>
          ) : payment && (payment.type === "FUNDED_PSBT" || payment.type === "RAW_PSBT") ? (
            <p className="text-amplifi-muted">Connect your Bitcoin wallet to sign.</p>
          ) : null}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
