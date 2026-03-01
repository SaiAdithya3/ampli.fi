import { MEMPOOL_API_BASE } from "@/lib/constants";

const SATS_PER_BTC = 100_000_000;

export interface BtcBalanceResult {
  balanceSats: number;
  balanceBtc: number;
}

interface MempoolAddressResponse {
  chain_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
  };
  mempool_stats: {
    funded_txo_sum: number;
    spent_txo_sum: number;
  };
}

/**
 * Fetches native BTC balance for an address via mempool.space.
 * Balance = confirmed (chain) + unconfirmed (mempool).
 */
export async function fetchBtcBalance(
  address: string
): Promise<BtcBalanceResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { balanceSats: 0, balanceBtc: 0 };
  }

  const res = await fetch(
    `${MEMPOOL_API_BASE}/address/${encodeURIComponent(trimmed)}`
  );
  if (!res.ok) {
    if (res.status === 404) return { balanceSats: 0, balanceBtc: 0 };
    throw new Error(`BTC balance failed: ${res.status}`);
  }

  const data = (await res.json()) as MempoolAddressResponse;
  const confirmed =
    (data.chain_stats?.funded_txo_sum ?? 0) - (data.chain_stats?.spent_txo_sum ?? 0);
  const unconfirmed =
    (data.mempool_stats?.funded_txo_sum ?? 0) - (data.mempool_stats?.spent_txo_sum ?? 0);
  const balanceSats = Math.max(0, confirmed + unconfirmed);
  const balanceBtc = balanceSats / SATS_PER_BTC;

  return { balanceSats, balanceBtc };
}
