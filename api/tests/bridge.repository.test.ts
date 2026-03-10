import test from "node:test";
import assert from "node:assert/strict";
import { PgBridgeRepository } from "../src/lib/bridge/repository.js";

test("PgBridgeRepository.createOrder maps DB row to domain order", async () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const fakePool = {
    query: async (_sql: string, values?: unknown[]) => {
      if (values?.[0] === undefined) {
        throw new Error("expected insert values");
      }
      return {
        rows: [
          {
            id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
            network: "testnet",
            source_asset: "BTC",
            destination_asset: "USDC",
            amount: "10000",
            amount_type: "exactIn",
            amount_source: null,
            amount_destination: null,
            deposit_address: null,
            receive_address: "0x0123",
            wallet_address: "0xwallet",
            status: "CREATED",
            action: "swap",
            atomiq_swap_id: null,
            source_tx_id: null,
            destination_tx_id: null,
            last_error: null,
            created_at: now,
            updated_at: now,
          },
        ],
      };
    },
  };

  const repository = new PgBridgeRepository(fakePool as any);
  const order = await repository.createOrder({
    network: "testnet",
    sourceAsset: "BTC",
    destinationAsset: "USDC",
    amount: "10000",
    amountType: "exactIn",
    receiveAddress: "0x0123",
    walletAddress: "0xwallet",
    action: "swap",
  });

  assert.equal(order.network, "testnet");
  assert.equal(order.status, "CREATED");
  assert.equal(order.action, "swap");
  assert.equal(order.atomiqSwapId, null);
  assert.equal(order.sourceAsset, "BTC");
});
