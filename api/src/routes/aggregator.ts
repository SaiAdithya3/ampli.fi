import { Router, Request, Response } from "express";
import { getPools, getPositions, getUserHistory } from "../lib/vesu.js";
import {
  asString,
  normalizeHistoryEntry,
  normalizePool,
  normalizePosition,
  parseOptionalBoolean,
  pickArray,
} from "../lib/aggregatorUtils.js";

const router = Router();
const PROTOCOL = "vesu";

router.get("/pools", async (req: Request, res: Response) => {
  try {
    const onlyVerified = parseOptionalBoolean(req.query.onlyVerified);
    const onlyEnabledAssets = parseOptionalBoolean(req.query.onlyEnabledAssets);

    const raw = await getPools({ onlyVerified, onlyEnabledAssets });
    const pools = pickArray(raw, ["data", "pools"]).map(normalizePool);
    const filtered = pools.filter((pool) => pool.isDeprecated !== true);

    return res.json({
      data: filtered.map((pool) => ({
        protocol: PROTOCOL,
        data: pool,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch pools";
    return res.status(502).json({ error: msg });
  }
});

router.get("/positions", async (req: Request, res: Response) => {
  const walletAddress = asString(req.query.walletAddress).trim();
  if (!walletAddress) {
    return res.status(400).json({ error: "walletAddress query parameter is required" });
  }

  try {
    const raw = await getPositions(walletAddress);
    const positions = pickArray(raw, ["data", "positions"]).map((entry) =>
      normalizePosition(entry, walletAddress)
    );
    return res.json({
      data: positions.map((position) => ({
        protocol: PROTOCOL,
        data: position,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch positions";
    return res.status(502).json({ error: msg });
  }
});

router.get("/users/:address/history", async (req: Request, res: Response) => {
  const address = asString(req.params.address).trim();
  if (!address) {
    return res.status(400).json({ error: "address path parameter is required" });
  }

  try {
    const raw = await getUserHistory(address);
    const history = pickArray(raw, ["data", "history"]).map(normalizeHistoryEntry);
    return res.json({
      data: history.map((entry) => ({
        protocol: PROTOCOL,
        data: entry,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch user history";
    return res.status(502).json({ error: msg });
  }
});

export default router;
