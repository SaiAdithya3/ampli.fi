import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/store/useWallet";
import { fetchBtcBalance } from "@/lib/btc-balance";

export interface UseBtcBalanceResult {
  /** Balance in satoshis. */
  balanceSats: number;
  /** Balance in BTC. */
  balanceBtc: number;
  /** Formatted string e.g. "0.00123456 BTC". */
  balanceFormatted: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useBtcBalance(): UseBtcBalanceResult {
  const { bitcoinPaymentAddress } = useWallet();
  const [balanceSats, setBalanceSats] = useState(0);
  const [balanceBtc, setBalanceBtc] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bitcoinPaymentAddress) {
      setBalanceSats(0);
      setBalanceBtc(0);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchBtcBalance(bitcoinPaymentAddress);
      setBalanceSats(result.balanceSats);
      setBalanceBtc(result.balanceBtc);
    } catch (e) {
      setBalanceSats(0);
      setBalanceBtc(0);
      setError(e instanceof Error ? e.message : "Failed to load BTC balance");
    } finally {
      setIsLoading(false);
    }
  }, [bitcoinPaymentAddress]);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (!cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const balanceFormatted =
    bitcoinPaymentAddress == null
      ? null
      : isLoading
        ? "…"
        : error
          ? null
          : balanceBtc >= 0.0001
            ? `${balanceBtc.toFixed(8)}`
            : balanceSats > 0
              ? `${balanceSats} sats`
              : "0";

  return {
    balanceSats,
    balanceBtc,
    balanceFormatted,
    isLoading,
    error,
    refetch: load,
  };
}