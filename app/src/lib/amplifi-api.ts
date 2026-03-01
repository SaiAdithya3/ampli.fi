import { API_URL } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Pagination (shared by aggregator endpoints)
// ---------------------------------------------------------------------------

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/** GET / – returns "Online" */
export async function getHealth(): Promise<string> {
  const res = await fetch(`${API_URL}/`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.text();
}

// ---------------------------------------------------------------------------
// Pools – GET /api/pools
// ---------------------------------------------------------------------------

export interface PoolAsset {
  [key: string]: unknown;
}

export interface PoolPair {
  [key: string]: unknown;
}

export interface PoolData {
  id: string;
  name: string;
  protocolVersion?: string;
  isDeprecated: boolean;
  assets: PoolAsset[];
  pairs: PoolPair[];
}

export interface PoolItem {
  protocol: string;
  data: PoolData;
}

export interface PoolsResponse {
  data: PoolItem[];
  meta: PaginationMeta;
}

export interface PoolsParams {
  onlyVerified?: boolean;
  onlyEnabledAssets?: boolean;
  page?: number;
  limit?: number;
}

export async function getPools(params: PoolsParams = {}): Promise<PoolsResponse> {
  const search = new URLSearchParams();
  if (params.onlyVerified !== undefined) search.set("onlyVerified", String(params.onlyVerified));
  if (params.onlyEnabledAssets !== undefined) search.set("onlyEnabledAssets", String(params.onlyEnabledAssets));
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await fetch(`${API_URL}/api/pools${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`Pools failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Positions – GET /api/positions
// ---------------------------------------------------------------------------

export interface PositionData {
  id: string;
  pool: string;
  type: string;
  collateral: string;
  collateralShares: string;
  walletAddress: string;
}

export interface PositionItem {
  protocol: string;
  data: PositionData;
}

export interface PositionsResponse {
  data: PositionItem[];
  meta: PaginationMeta;
}

export async function getPositions(
  walletAddress: string,
  page = 1,
  limit = 20
): Promise<PositionsResponse> {
  const search = new URLSearchParams({
    walletAddress,
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`${API_URL}/api/positions?${search.toString()}`);
  if (!res.ok) throw new Error(`Positions failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// User history – GET /api/users/:address/history
// ---------------------------------------------------------------------------

export interface UserHistoryItemData {
  pool: string;
  txHash: string;
  timestamp: number;
  collateral: string;
  type: string;
}

export interface UserHistoryItem {
  protocol: string;
  data: UserHistoryItemData;
}

export interface UserHistoryResponse {
  data: UserHistoryItem[];
  meta: PaginationMeta;
}

export async function getUserHistory(
  address: string,
  page = 1,
  limit = 20
): Promise<UserHistoryResponse> {
  const search = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(
    `${API_URL}/api/users/${encodeURIComponent(address)}/history?${search.toString()}`
  );
  if (!res.ok) throw new Error(`User history failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Loan offers – GET /api/offers/loan
// ---------------------------------------------------------------------------

export interface LoanOfferQuote {
  mode?: "borrowToCollateral" | "collateralToBorrow";
  borrowUsd: number;
  targetLtv: number;
  requiredCollateralUsd: number;
  requiredCollateralAmount: number | null;
  liquidationPrice: number;
  /** collateralToBorrow mode */
  collateralAmount?: number | null;
  collateralUsd?: number | null;
  maxBorrowUsd?: number | null;
  maxBorrowAmount?: number | null;
}

export interface LoanOfferAsset {
  symbol: string;
  address: string;
  decimals: number;
}

export interface LoanOfferData {
  offerId: string;
  pool: { id: string; name: string };
  collateral: LoanOfferAsset;
  borrow: LoanOfferAsset;
  chain: string;
  maxLtv: number;
  liquidationFactor: number;
  borrowApr: number;
  collateralApr: number;
  netApy: number;
  quote: LoanOfferQuote | null;
}

export interface LoanOfferItem {
  protocol: string;
  data: LoanOfferData;
}

export interface PaginatedLoanOffers {
  data: LoanOfferItem[];
  meta: PaginationMeta;
}

export interface LoanOffersParams {
  collateral: string;
  borrow: string;
  mode?: "borrowToCollateral" | "collateralToBorrow";
  borrowUsd?: number;
  collateralAmount?: number;
  targetLtv?: number;
  sortBy?: "netApy" | "maxLtv" | "liquidationPrice";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function getLoanOffers(
  params: LoanOffersParams
): Promise<PaginatedLoanOffers> {
  const search = new URLSearchParams();
  search.set("collateral", params.collateral);
  search.set("borrow", params.borrow);
  if (params.mode) search.set("mode", params.mode);
  if (params.borrowUsd != null) search.set("borrowUsd", String(params.borrowUsd));
  if (params.collateralAmount != null) search.set("collateralAmount", String(params.collateralAmount));
  if (params.targetLtv != null) search.set("targetLtv", String(params.targetLtv));
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));

  const res = await fetch(`${API_URL}/api/offers/loan?${search.toString()}`);
  if (!res.ok) throw new Error(`Loan offers failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Bridge – /api/bridge/orders
// ---------------------------------------------------------------------------

export interface PaymentAddress {
  type: "ADDRESS";
  address: string;
  amountSats: string;
}

export interface PaymentFundedPsbt {
  type: "FUNDED_PSBT";
  psbtBase64: string;
  psbtHex?: string;
  /** Input indices to sign; if omitted, frontend defaults to [0..inputsLength-1] */
  signInputs?: number[];
}

export interface PaymentRawPsbt {
  type: "RAW_PSBT";
  psbtBase64: string;
  psbtHex?: string;
  /** Input indices to sign; if omitted, frontend defaults to [0..inputsLength-1] */
  signInputs?: number[];
  in1sequence?: number;
}

export type BridgeOrderPayment =
  | PaymentAddress
  | PaymentFundedPsbt
  | PaymentRawPsbt;

export interface BridgeOrderQuote {
  amountIn: string;
  amountOut: string;
  depositAddress?: string;
}

export interface BridgeOrderCreated {
  orderId: string;
  status: string;
  depositAddress?: string;
  amountSats?: string;
  payment?: BridgeOrderPayment;
  quote?: BridgeOrderQuote;
}

export interface CreateBridgeOrderBody {
  sourceAsset: "BTC";
  destinationAsset: "USDC" | "ETH" | "STRK" | "WBTC" | "USDT" | "TBTC";
  amount: string;
  amountType: "exactIn" | "exactOut";
  receiveAddress: string;
  walletAddress: string;
  /** Option A: both required together for FUNDED_PSBT (backend uses Atomiq txsExecute with wallet context) */
  bitcoinPaymentAddress?: string;
  bitcoinPublicKey?: string;
}

export async function createBridgeOrder(
  body: CreateBridgeOrderBody
): Promise<{ data: BridgeOrderCreated }> {
  const res = await fetch(`${API_URL}/api/bridge/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? err?.message ?? `Create order failed: ${res.status}`);
  }
  return res.json();
}

export async function submitBridgeOrder(
  orderId: string,
  body: { signedPsbtBase64?: string; sourceTxId?: string }
): Promise<unknown> {
  const res = await fetch(`${API_URL}/api/bridge/orders/${encodeURIComponent(orderId)}/submit-psbt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submit order failed: ${res.status}`);
  return res.json();
}

export interface BridgeOrderDetail {
  orderId: string;
  status: string;
  quote?: {
    amountIn: string;
    amountOut: string;
    depositAddress?: string;
  };
  sourceTxId?: string;
  destinationTxId?: string;
  expiresAt?: string;
  rawState?: unknown;
  error?: string;
}

export async function getBridgeOrder(orderId: string): Promise<{ data?: BridgeOrderDetail } & Partial<BridgeOrderDetail>> {
  const res = await fetch(`${API_URL}/api/bridge/orders/${encodeURIComponent(orderId)}`);
  if (!res.ok) throw new Error(`Get order failed: ${res.status}`);
  return res.json();
}

export interface BridgeOrdersListParams {
  walletAddress: string;
  page?: number;
  limit?: number;
}

export async function getBridgeOrders(
  params: BridgeOrdersListParams
): Promise<{ data: unknown[]; meta?: PaginationMeta }> {
  const search = new URLSearchParams({ walletAddress: params.walletAddress });
  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  const res = await fetch(`${API_URL}/api/bridge/orders?${search.toString()}`);
  if (!res.ok) throw new Error(`Bridge orders list failed: ${res.status}`);
  return res.json();
}

export async function retryBridgeOrder(orderId: string): Promise<unknown> {
  const res = await fetch(`${API_URL}/api/bridge/orders/${encodeURIComponent(orderId)}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Retry order failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Wallet (write) – POST /api/wallet/starknet, POST /api/wallet/sign
// Used by usePrivyStarknet; sign is called by SDK via serverUrl.
// ---------------------------------------------------------------------------

export async function createStarknetWallet(token?: string): Promise<{ wallet: { id?: string; publicKey?: string; public_key?: string } }> {
  const res = await fetch(`${API_URL}/api/wallet/starknet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Create wallet failed");
  return data;
}

export async function signWithWallet(body: { walletId: string; hash: string }): Promise<{ signature: string }> {
  const res = await fetch(`${API_URL}/api/wallet/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Wallet sign failed");
  return res.json();
}
