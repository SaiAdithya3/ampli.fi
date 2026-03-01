import { MEMPOOL_API_BASE } from "@/lib/constants";

/**
 * Broadcasts a raw Bitcoin transaction hex via mempool.space API.
 * @returns Transaction ID (txid)
 */
export async function broadcastBtcTx(txHex: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_API_BASE}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: txHex,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Broadcast failed: ${res.status}`);
  }
  return res.text();
}
