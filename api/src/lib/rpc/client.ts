/**
 * Shared RPC client with concurrency limiting, rate limiting, and response caching
 * to avoid 429 (rate limit / compute units) from Alchemy and other providers.
 *
 * IMPORTANT: `_rawFetch` stores the original `globalThis.fetch` BEFORE patching.
 * `rpcCall` always uses `_rawFetch` so it never re-enters the patched fetch,
 * which would deadlock on the concurrency semaphore.
 */

const MAX_CONCURRENT = 2;
const MIN_MS_BETWEEN_CALLS = 500; // ~2 calls/sec
const CACHE_TTL_MS = 60_000;
const MAX_RETRIES_ON_429 = 4;
const RETRY_BASE_MS = 2000;

let _rawFetch: typeof globalThis.fetch | null = null;
let rpcUrlForPatch: string | null = null;

function rawFetch(): typeof globalThis.fetch {
  return _rawFetch ?? globalThis.fetch;
}

type CacheEntry = { result: unknown; expiry: number };

let queue: Array<() => void> = [];
let inFlight = 0;
let lastCallTime = 0;

async function withConcurrencyLimit<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    const next = queue.shift();
    if (next) next();
  }
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < MIN_MS_BETWEEN_CALLS) {
    await new Promise((r) => setTimeout(r, MIN_MS_BETWEEN_CALLS - elapsed));
  }
  lastCallTime = Date.now();
}

const cache = new Map<string, CacheEntry>();

function cacheKey(method: string, params: unknown): string {
  return `${method}:${JSON.stringify(params)}`;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.expiry < Date.now()) return null;
  return entry.result as T;
}

function setCache(key: string, result: unknown): void {
  cache.set(key, { result, expiry: Date.now() + CACHE_TTL_MS });
}

const CACHEABLE_METHODS = new Set([
  "starknet_call",
  "starknet_chainId",
  "starknet_blockNumber",
  "starknet_getBlockWithTxHashes",
]);

export async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<T> {
  const key = cacheKey(method, params);
  if (CACHEABLE_METHODS.has(method)) {
    const cached = getCached<T>(key);
    if (cached !== null) return cached;
  }

  const result = await withConcurrencyLimit(async () => {
    await rateLimit();

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
      try {
        const res = await rawFetch()(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method,
            params,
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          result?: T;
          error?: { message?: string };
        };

        const is429 =
          res.status === 429 || payload.error?.message?.includes("429");
        if (is429 && attempt < MAX_RETRIES_ON_429) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!res.ok || payload.error) {
          const message =
            payload.error?.message || `RPC call failed (${res.status})`;
          throw new Error(message);
        }

        return payload.result as T;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (lastErr.message.includes("429") && attempt < MAX_RETRIES_ON_429) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr ?? new Error("RPC call failed");
  });

  if (CACHEABLE_METHODS.has(method)) {
    setCache(key, result);
  }

  return result;
}

function isRpcRequest(url: string): boolean {
  if (!rpcUrlForPatch) return false;
  try {
    const target = new URL(url);
    const base = new URL(rpcUrlForPatch);
    return target.origin === base.origin;
  } catch {
    return url.startsWith(rpcUrlForPatch);
  }
}

/**
 * Patches global fetch to throttle and cache RPC requests.
 * Call at server startup so StarkZap/starknet RpcProvider use it.
 */
export function patchRpcFetch(url: string): void {
  if (typeof globalThis.fetch === "undefined") return;
  _rawFetch = globalThis.fetch.bind(globalThis);
  rpcUrlForPatch = url;
  const savedFetch = _rawFetch;

  globalThis.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const reqUrl = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!isRpcRequest(reqUrl)) {
      return savedFetch(input, init);
    }

    const method = init?.method ?? "GET";
    if (method !== "POST") return savedFetch(input, init);

    let body: string;
    if (init?.body && typeof init.body === "string") {
      body = init.body;
    } else if (input instanceof Request && input.body) {
      body = await input.clone().text();
    } else {
      return savedFetch(input, init);
    }

    let parsed: { method?: string; params?: unknown };
    try {
      parsed = JSON.parse(body) as { method?: string; params?: unknown };
    } catch {
      return savedFetch(input, init);
    }

    const rpcMethod = parsed.method ?? "";
    const params =
      parsed.params !== undefined
        ? Array.isArray(parsed.params)
          ? parsed.params
          : [parsed.params]
        : [];

    const result = await rpcCall<unknown>(rpcUrlForPatch!, rpcMethod, params);

    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: (parsed as { id?: number }).id, result }),
      { headers: { "Content-Type": "application/json" } }
    );
  };
}
