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

        // Get pool_id from vToken
        const poolIdRaw = await vTokenContract.pool_id();
        const poolId =
          typeof poolIdRaw === "string"
            ? poolIdRaw
            : "0x" + poolIdRaw.toString(16);

        // Get pool address from vToken.extension()
        const extensionRaw = await vTokenContract.extension();
        const poolAddress =
          typeof extensionRaw === "string"
            ? extensionRaw
            : "0x" + extensionRaw.toString(16);

        // Get collateral asset from vToken.asset()
        const assetAddressRaw = await vTokenContract.asset();
        const assetAddress =
          typeof assetAddressRaw === "string"
            ? assetAddressRaw
            : "0x" + assetAddressRaw.toString(16);

        // Check WBTC balance
        const assetContract = new Contract(vTokenABI, assetAddress, starknetAccount);
        const balanceRaw = await assetContract.balanceOf(starknetAccount.address);
        const balance = BigInt(balanceRaw.toString());

        if (balance === 0n) {
          throw new Error(
            "No token balance available to deposit. The swap may not have completed yet."
          );
        }

        const requestedCollateral = BigInt(collateralAmount);
        // Use the lesser of requested amount and actual balance
        const depositAmount = requestedCollateral > balance ? balance : requestedCollateral;

        // Check existing allowance, approve to Pool contract if needed
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

        // Build modify_position calldata
        // modify_position(pool_id, collateral_asset, debt_asset, user, collateral, debt, data)
        //
        // Vesu Pool.modify_position params:
        //   collateral_asset: ContractAddress
        //   debt_asset: ContractAddress
        //   user: ContractAddress
        //   collateral: Amount { amount_type: felt252, denomination: felt252, value: i257 { abs: u256, is_negative: bool } }
        //   debt: Amount { amount_type: felt252, denomination: felt252, value: i257 { abs: u256, is_negative: bool } }
        //   data: Span<felt252>
        const { low: collateralLow, high: collateralHigh } = splitU256(depositAmount);
        const borrowValue = BigInt(borrowAmount);
        const { low: borrowLow, high: borrowHigh } = splitU256(borrowValue);

        calls.push({
          contractAddress: poolAddress,
          entrypoint: "modify_position",
          calldata: [
            poolId,                    // pool_id
            collateralAssetAddress,    // collateral_asset
            debtAssetAddress,          // debt_asset
            starknetAccount.address,   // user
            // collateral Amount:
            "1",                       // amount_type = Delta (1)
            "1",                       // denomination = Assets (1)
            collateralLow,             // value.abs.low
            collateralHigh,            // value.abs.high
            "0",                       // value.is_negative = false
            // debt Amount:
            "1",                       // amount_type = Delta (1)
            "1",                       // denomination = Assets (1)
            borrowLow,                 // value.abs.low
            borrowHigh,                // value.abs.high
            "0",                       // value.is_negative = false
            // data: empty Span<felt252>
            "0",                       // data length = 0
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
