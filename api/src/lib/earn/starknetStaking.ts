import {
  StarkZap,
  Staking,
  fromAddress,
  mainnetValidators,
  sepoliaValidators,
  type Address,
  type Pool,
  type PoolMember,
  type Validator,
  type WalletInterface,
} from "starkzap";
import { Contract, RpcProvider } from "starknet";
import type { EarnProtocolAdapter } from "./protocols.js";
import type { EarnHistoryEntry, EarnPool, EarnPosition, EarnToken } from "../../types/earn.js";
import { settings } from "../settings.js";
import { fetchNativeStakingHistory } from "./eventFetcher.js";

const POOL_COMMISSION_ABI = [
  {
    type: "interface" as const,
    name: "staking::pool::interface::IPool",
    items: [
      {
        type: "function" as const,
        name: "contract_parameters_v1",
        inputs: [] as const,
        outputs: [{ type: "staking::pool::interface::PoolContractInfoV1" }],
        state_mutability: "view" as const,
      },
    ],
  },
  {
    type: "struct" as const,
    name: "staking::pool::interface::PoolContractInfoV1",
    members: [
      { name: "staker_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "staker_removed", type: "core::bool" },
      { name: "staking_contract", type: "core::starknet::contract_address::ContractAddress" },
      { name: "token_address", type: "core::starknet::contract_address::ContractAddress" },
      { name: "commission", type: "core::integer::u16" },
    ],
  },
];

const PROTOCOL = "native_staking";
const MAINNET_STAKING_CONTRACT =
  "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7";
const SEPOLIA_STAKING_CONTRACT =
  "0x03745ab04a431fc02871a139be6b93d9260b0ff3e779ad9c8b377183b23109f1";

function normalizeHex(value: string): string {
  const sanitized = value.toLowerCase();
  return sanitized.startsWith("0x") ? sanitized : `0x${sanitized}`;
}

type LightweightWallet = {
  address: Address;
};

function getSdk(): StarkZap {
  const network = settings.network === "mainnet" ? "mainnet" : "sepolia";
  return new StarkZap({
    network,
    rpcUrl: settings.rpc_url,
  });
}

function getStakingConfig(): { contract: Address } {
  const contract =
    settings.network === "mainnet" ? MAINNET_STAKING_CONTRACT : SEPOLIA_STAKING_CONTRACT;
  return { contract: fromAddress(contract) };
}

/**
 * Top mainnet validators by delegation/recognition.
 * Keeps getStakerPools() to ~25 validators × ~2 RPC calls = ~50 calls
 * instead of 138 × 2 = ~276 (most of which fail with "Staker does not exist").
 */
const MAINNET_VALIDATOR_WHITELIST = new Set([
  "Karnot",
  "Twinstake",
  "AVNU",
  "Braavos",
  "Binance",
  "Nethermind",
  "Nansen",
  "Pragma",
  "Figment",
  "P2P.org",
  "stakefish",
  "Carbonable",
  "Keplr",
  "Cartridge",
  "Zellic",
  "Herodotus",
  "Fibrous",
  "Stakely",
  "Allnodes",
  "zkLend",
  "Anchorage Digital",
  "Stakecito",
  "DSRV",
  "Moonlet",
  "Cumulo",
]);

function getValidators(): Validator[] {
  if (settings.network === "mainnet") {
    return Object.values(mainnetValidators).filter((v) =>
      MAINNET_VALIDATOR_WHITELIST.has(v.name)
    );
  }
  return Object.values(sepoliaValidators);
}

function toToken(token: Pool["token"]): EarnToken {
  return {
    symbol: token.symbol,
    address: token.address,
    decimals: token.decimals ?? null,
  };
}

/**
 * Lightweight pool conversion — avoids Staking.fromPool() and getCommission()
 * which each trigger 3-4 extra RPC calls per pool. Commission is fetched
 * lazily when the user selects a pool to stake in.
 */
function toEarnPoolLight(validator: Validator, pool: Pool): EarnPool {
  return {
    id: `${validator.stakerAddress}:${pool.poolContract}`,
    poolContract: pool.poolContract,
    validator: {
      name: validator.name,
      stakerAddress: validator.stakerAddress,
    },
    token: toToken(pool.token),
    delegatedAmount: pool.amount.toUnit(),
    commissionPercent: null,
  };
}

async function getPools(validatorFilter?: string): Promise<EarnPool[]> {
  const sdk = getSdk();
  const validators = getValidators();
  const filteredValidators = validatorFilter
    ? validators.filter((entry) => entry.stakerAddress.toLowerCase() === validatorFilter.toLowerCase())
    : validators;

  const allPools: EarnPool[] = [];
  for (const validator of filteredValidators) {
    try {
      const pools = await sdk.getStakerPools(validator.stakerAddress);
      for (const pool of pools) {
        allPools.push(toEarnPoolLight(validator, pool));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Staker does not exist")) {
        continue;
      }
      throw err;
    }
  }
  return allPools;
}

async function getPosition(
  sdk: StarkZap,
  poolAddress: string,
  userAddress: string,
  token: EarnToken
): Promise<EarnPosition | null> {
  const staking = await Staking.fromPool(fromAddress(poolAddress), sdk.getProvider(), getStakingConfig());

  const wallet = { address: fromAddress(userAddress) } as LightweightWallet;
  const position = (await staking.getPosition(wallet as unknown as WalletInterface)) as PoolMember | null;
  if (!position) return null;

  return {
    poolContract: poolAddress,
    token,
    staked: position.staked.toUnit(),
    rewards: position.rewards.toUnit(),
    total: position.total.toUnit(),
    unpooling: position.unpooling.toUnit(),
    unpoolTime: position.unpoolTime ? position.unpoolTime.toISOString() : null,
    commissionPercent: position.commissionPercent,
    rewardAddress: position.rewardAddress,
    walletAddress: userAddress,
  };
}

async function getPositions(userAddress: string): Promise<EarnPosition[]> {
  const sdk = getSdk();
  const pools = await getPools();
  const results: EarnPosition[] = [];
  for (const pool of pools) {
    const pos = await getPosition(sdk, pool.poolContract, userAddress, pool.token);
    if (pos) results.push(pos);
  }
  return results;
}

async function getHistory(userAddress: string, opts?: { type?: string }): Promise<EarnHistoryEntry[]> {
  const sdk = getSdk();
  const pools = await getPools();
  const poolAddresses = Array.from(new Set(pools.map((pool) => pool.poolContract)));
  const tokenByPool = new Map<string, EarnToken>(
    pools.map((pool) => [normalizeHex(pool.poolContract), pool.token])
  );

  const history = await fetchNativeStakingHistory({
    rpcUrl: settings.rpc_url,
    poolAddresses,
    userAddress,
    tokenByPoolAddress: tokenByPool,
  });

  if (!opts?.type) {
    return history;
  }

  return history.filter((entry) => entry.type === opts.type);
}

async function fetchPoolCommission(poolContract: string): Promise<number | null> {
  try {
    const provider = new RpcProvider({ nodeUrl: settings.rpc_url });
    const contract = new Contract({ abi: POOL_COMMISSION_ABI, address: poolContract, providerOrAccount: provider });
    const params = await (contract as any).contract_parameters_v1();
    return Number(params.commission) / 100;
  } catch {
    return null;
  }
}

async function enrichPoolCommissions(pools: EarnPool[]): Promise<void> {
  for (const pool of pools) {
    if (pool.commissionPercent === null) {
      pool.commissionPercent = await fetchPoolCommission(pool.poolContract);
    }
  }
}

export function createNativeStakingAdapter(): EarnProtocolAdapter {
  return {
    protocol: PROTOCOL,
    getPools,
    getPositions,
    getHistory,
    enrichPoolCommissions,
  };
}
