import { useState, useCallback } from "react";
import { Contract, RpcProvider } from "starknet";
import { useWallet } from "@/store/useWallet";
import { RPC_URL } from "@/lib/constants";
import vTokenABI from "@/lib/vesu/abi.json";

export interface BorrowParams {
  vTokenAddress: string;
  collateralAmount: string;
  collateralAssetAddress: string;
  debtAssetAddress: string;
  borrowAmount: string;
}

export interface BorrowResult {
  txHash: string;
  poolAddress: string;
  poolId: string;
  actualCollateralAmount: string;
  actualBorrowAmount: string;
}

export interface UseVesuBorrowResult {
  borrow: (params: BorrowParams) => Promise<BorrowResult>;
  isBorrowing: boolean;
  error: string | null;
}

function splitU256(value: bigint): { low: string; high: string } {
  const mask = (1n << 128n) - 1n;
  return {
    low: "0x" + (value & mask).toString(16),
    high: "0x" + (value >> 128n).toString(16),
  };
}

function toHex(raw: unknown): string {
  return typeof raw === "string" ? raw : "0x" + BigInt(String(raw)).toString(16);
}

/**
 * Try reading pool_id and extension from the vToken (Vesu v1).
 * Returns null if the contract doesn't implement these (Vesu v2 ERC4626 vaults).
 */
async function tryReadV1PoolInfo(
  vTokenContract: InstanceType<typeof Contract>
): Promise<{ poolId: string; poolAddress: string } | null> {
  try {
    const [poolIdRaw, extensionRaw] = await Promise.all([
      vTokenContract.pool_id(),
      vTokenContract.extension(),
    ]);
    return { poolId: toHex(poolIdRaw), poolAddress: toHex(extensionRaw) };
  } catch {
    return null;
  }
}

export function useVesuBorrow(): UseVesuBorrowResult {
  const { starknetAccount } = useWallet();
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borrow = useCallback(
    async (params: BorrowParams): Promise<BorrowResult> => {
      if (!starknetAccount) {
        throw new Error("Starknet account not connected");
      }

      const {
        vTokenAddress,
        collateralAmount,
        collateralAssetAddress,
        debtAssetAddress,
        borrowAmount,
      } = params;

      setIsBorrowing(true);
      setError(null);

      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        const vTokenContract = new Contract(vTokenABI, vTokenAddress, starknetAccount);

        const assetAddressRaw = await vTokenContract.asset();
        const assetAddress = toHex(assetAddressRaw);

        const assetContract = new Contract(vTokenABI, assetAddress, starknetAccount);
        const balanceRaw = await assetContract.balanceOf(starknetAccount.address);
        const balance = BigInt(balanceRaw.toString());

        if (balance === 0n) {
          throw new Error(
            "No token balance available to deposit. The swap may not have completed yet."
          );
        }

        const requestedCollateral = BigInt(collateralAmount);
        const depositAmount = requestedCollateral > balance ? balance : requestedCollateral;

        const v1Info = await tryReadV1PoolInfo(vTokenContract);

        if (v1Info) {
          // --- Vesu v1: modify_position on the extension (singleton) contract ---
          const { poolId, poolAddress } = v1Info;
          const allowanceRaw = await assetContract.allowance(starknetAccount.address, poolAddress);
          const allowance = BigInt(allowanceRaw.toString());

          const calls: { contractAddress: string; entrypoint: string; calldata: string[] }[] = [];
          if (allowance < depositAmount) {
            const { low: approveLow, high: approveHigh } = splitU256(depositAmount);
            calls.push({
              contractAddress: assetAddress,
              entrypoint: "approve",
              calldata: [poolAddress, approveLow, approveHigh],
            });
          }

          const { low: collateralLow, high: collateralHigh } = splitU256(depositAmount);
          const borrowValue = BigInt(borrowAmount);
          const { low: borrowLow, high: borrowHigh } = splitU256(borrowValue);

          calls.push({
            contractAddress: poolAddress,
            entrypoint: "modify_position",
            calldata: [
              poolId,
              collateralAssetAddress,
              debtAssetAddress,
              starknetAccount.address,
              "1", "1", collateralLow, collateralHigh, "0",
              "1", "1", borrowLow, borrowHigh, "0",
              "0",
            ],
          });

          const result = await starknetAccount.execute(calls);
          await provider.waitForTransaction(result.transaction_hash);

          return {
            txHash: result.transaction_hash,
            poolAddress,
            poolId,
            actualCollateralAmount: depositAmount.toString(),
            actualBorrowAmount: borrowValue.toString(),
          };
        }

        // --- Vesu v2: ERC4626 deposit on the vToken ---
        const allowanceRaw = await assetContract.allowance(starknetAccount.address, vTokenAddress);
        const allowance = BigInt(allowanceRaw.toString());

        const calls: { contractAddress: string; entrypoint: string; calldata: string[] }[] = [];
        if (allowance < depositAmount) {
          const { low: approveLow, high: approveHigh } = splitU256(depositAmount);
          calls.push({
            contractAddress: assetAddress,
            entrypoint: "approve",
            calldata: [vTokenAddress, approveLow, approveHigh],
          });
        }

        const { low: depositLow, high: depositHigh } = splitU256(depositAmount);
        calls.push({
          contractAddress: vTokenAddress,
          entrypoint: "deposit",
          calldata: [depositLow, depositHigh, starknetAccount.address],
        });

        const result = await starknetAccount.execute(calls);
        await provider.waitForTransaction(result.transaction_hash);

        return {
          txHash: result.transaction_hash,
          poolAddress: vTokenAddress,
          poolId: "",
          actualCollateralAmount: depositAmount.toString(),
          actualBorrowAmount: "0",
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to supply & borrow";
        setError(message);
        throw new Error(message);
      } finally {
        setIsBorrowing(false);
      }
    },
    [starknetAccount]
  );

  return { borrow, isBorrowing, error };
}
