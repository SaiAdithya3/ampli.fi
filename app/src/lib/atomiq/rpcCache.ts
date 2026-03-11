/**
 * Caches starknet_getEvents and starknet_getBlockWithTxHashes RPC responses
 * to reduce duplicate calls from Atomiq SDK's event poller (runs every 5s).
 * When no new blocks, the same params yield identical responses — cache for 4s.
 */

const CACHE_TTL_MS = 4_000;
const CACHEABLE_METHODS = new Set([
  "starknet_getEvents",
  "starknet_getBlockWithTxHashes",
]);

type CacheEntry = { response: Response; expiry: number };

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string, method: string, params: unknown): string {
  return `${url}|${method}|${JSON.stringify(params)}`;
}

function isRpcUrl(targetUrl: string, rpcUrl: string): boolean {
  if (!rpcUrl) return false;
  try {
    const target = new URL(targetUrl);
    const base = new URL(rpcUrl);
    return target.origin === base.origin;
  } catch {
    return targetUrl.startsWith(rpcUrl) || rpcUrl.includes(targetUrl);
  }
}

export function patchRpcCache(rpcUrl: string): void {
  if (typeof window === "undefined" || !rpcUrl) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!isRpcUrl(url, rpcUrl)) {
      return originalFetch(input, init);
    }

    const method = init?.method ?? "GET";
    if (method !== "POST") return originalFetch(input, init);

    let body: string | undefined;
    if (init?.body) {
      body = typeof init.body === "string" ? init.body : undefined;
    } else if (input instanceof Request && input.body) {
      body = await input.clone().text();
    }
    if (!body) return originalFetch(input, init);

    let parsed: { method?: string; params?: unknown };
    try {
      parsed = JSON.parse(body) as { method?: string; params?: unknown };
    } catch {
      return originalFetch(input, init);
    }

    const rpcMethod = parsed.method;
    if (!rpcMethod || !CACHEABLE_METHODS.has(rpcMethod)) {
      return originalFetch(input, init);
    }

    const key = getCacheKey(url, rpcMethod, parsed.params);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.response.clone();
    }

    const response = await originalFetch(input, init);
    if (response.ok) {
      cache.set(key, {
        response: response.clone(),
        expiry: now + CACHE_TTL_MS,
      });
    }
    return response;
  };
}
