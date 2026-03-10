import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import bridgeRouter from "../src/routes/bridge.js";
import { BridgeOrder, BridgeOrderPage } from "../src/lib/bridge/types.js";
import { BridgeService } from "../src/lib/bridge/bridgeService.js";
import { BridgeRepository } from "../src/lib/bridge/repository.js";

const NOW = new Date().toISOString();

function makeOrder(overrides: Partial<BridgeOrder> = {}): BridgeOrder {
  return {
    id: "order-1",
    network: "testnet",
    sourceAsset: "BTC",
    destinationAsset: "USDC",
    amount: "100000",
    amountType: "exactIn",
    amountSource: null,
    amountDestination: null,
    depositAddress: null,
    receiveAddress: "0x0123456789012345678901234567890123456789012345678901234567890123",
    walletAddress: "0xwallet",
    status: "CREATED",
    action: "swap",
    atomiqSwapId: null,
    sourceTxId: null,
    destinationTxId: null,
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEmptyPage(): BridgeOrderPage {
  return {
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

/** In-memory repository for tests */
class InMemoryRepo implements BridgeRepository {
  orders = new Map<string, BridgeOrder>();

  async init() {}

  async createOrder(input: Parameters<BridgeRepository["createOrder"]>[0]): Promise<BridgeOrder> {
    const order = makeOrder({
      id: `order-${this.orders.size + 1}`,
      destinationAsset: input.destinationAsset,
      amount: input.amount,
      amountType: input.amountType,
      receiveAddress: input.receiveAddress,
      walletAddress: input.walletAddress,
      action: input.action,
    });
    this.orders.set(order.id, order);
    return order;
  }

  async getOrderById(id: string) {
    return this.orders.get(id) ?? null;
  }

  async listOrdersByWallet(walletAddress: string, page: number, limit: number) {
    const all = [...this.orders.values()].filter((o) => o.walletAddress === walletAddress);
    return {
      data: all.slice((page - 1) * limit, page * limit),
      meta: {
        total: all.length,
        page,
        limit,
        totalPages: Math.ceil(all.length / limit) || 0,
        hasNextPage: page * limit < all.length,
        hasPrevPage: page > 1,
      },
    };
  }

  async updateOrder(id: string, patch: Record<string, unknown>) {
    const order = this.orders.get(id);
    if (!order) throw new Error("Bridge order not found");
    const updated = { ...order, ...patch, updatedAt: NOW };
    this.orders.set(id, updated);
    return updated;
  }
}

function createApp(): express.Express {
  const repo = new InMemoryRepo();
  // Seed one order
  repo.orders.set("order-1", makeOrder());

  const service = new BridgeService(repo);

  const app = express();
  app.use(express.json());

  // Mount the router at the same prefix the real server uses
  // But since bridge.ts exports a router directly, we mount it at /api/bridge
  // However, the real server imports `bridgeRouter` as a default export.
  // We need to patch getService — the router uses a module-level singleton.
  // For unit tests, we'll create our own mini-app with the service.
  // Since the router uses an internal getService(), we'll test via the service directly
  // and test validation separately.

  return app;
}

test("BridgeService.createOrder returns order with CREATED status", async () => {
  const repo = new InMemoryRepo();
  const service = new BridgeService(repo);
  await service.init();

  const order = await service.createOrder({
    network: "testnet",
    sourceAsset: "BTC",
    destinationAsset: "USDC",
    amount: "10000",
    amountType: "exactIn",
    receiveAddress: "0x0123456789012345678901234567890123456789012345678901234567890123",
    walletAddress: "0xabc",
    action: "swap",
  });

  assert.equal(order.status, "CREATED");
  assert.equal(order.action, "swap");
  assert.equal(order.sourceAsset, "BTC");
});

test("BridgeService.linkAtomiqSwapId updates swap ID", async () => {
  const repo = new InMemoryRepo();
  repo.orders.set("order-1", makeOrder());
  const service = new BridgeService(repo);
  await service.init();

  const updated = await service.linkAtomiqSwapId("order-1", "atomiq-swap-123");
  assert.equal(updated.atomiqSwapId, "atomiq-swap-123");
});

test("BridgeService.linkBtcTxHash updates source tx ID and status", async () => {
  const repo = new InMemoryRepo();
  repo.orders.set("order-1", makeOrder({ status: "SWAP_CREATED" }));
  const service = new BridgeService(repo);
  await service.init();

  const updated = await service.linkBtcTxHash("order-1", "abc123txhash");
  assert.equal(updated.sourceTxId, "abc123txhash");
});

test("BridgeService.updateStatus transitions status", async () => {
  const repo = new InMemoryRepo();
  repo.orders.set("order-1", makeOrder({ status: "BTC_CONFIRMED" }));
  const service = new BridgeService(repo);
  await service.init();

  const updated = await service.updateStatus("order-1", "CLAIMING", {});
  assert.equal(updated.status, "CLAIMING");
});

test("BridgeService.getOrder throws for unknown ID", async () => {
  const repo = new InMemoryRepo();
  const service = new BridgeService(repo);
  await service.init();

  await assert.rejects(
    () => service.getOrder("nonexistent"),
    { message: "Bridge order not found" }
  );
});

test("BridgeService.listOrders returns paginated results", async () => {
  const repo = new InMemoryRepo();
  repo.orders.set("order-1", makeOrder({ walletAddress: "0xabc" }));
  repo.orders.set("order-2", makeOrder({ id: "order-2", walletAddress: "0xabc" }));
  const service = new BridgeService(repo);
  await service.init();

  const result = await service.listOrders("0xabc", 1, 10);
  assert.equal(result.data.length, 2);
  assert.equal(result.meta.total, 2);
});
