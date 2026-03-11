import { useState, useCallback } from "react";
import { Contract, RpcProvider } from "starknet";
import { useWallet } from "@/store/useWallet";
import { RPC_URL } from "@/lib/constants";
import vTokenABI from "@/lib/vesu/abi.json";

export interface UseVesuDepositResult {
  deposit: (amount: string, vTokenAddress: string) => Promise<string>;
  isDepositing: boolean;
  error: string | null;
}

export function useVesuDeposit(): UseVesuDepositResult {
  const { starknetAccount } = useWallet();
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (amount: string, vTokenAddress: string): Promise<string> => {
      if (!starknetAccount) {
        throw new Error("Starknet account not connected");
      }
      if (!vTokenAddress) {
        throw new Error("V-Token address not provided");
      }

      setIsDepositing(true);
      setError(null);

      try {
        const provider = new RpcProvider({ nodeUrl: RPC_URL });
        const contract = new Contract(vTokenABI, vTokenAddress, starknetAccount);

        const assetsValue = BigInt(amount);

        // Get the underlying asset address for approval
        const assetAddressRaw = await contract.asset();
        // contract.asset() returns a BigInt (felt252) — convert to hex string
        const assetAddress =
          typeof assetAddressRaw === "string"
            ? assetAddressRaw
            : "0x" + assetAddressRaw.toString(16);

        // Check actual token balance — the received amount may differ from
        // the stored collateralAmount due to swap fees/slippage.
        const assetContract = new Contract(vTokenABI, assetAddress, starknetAccount);
        const balanceRaw = await assetContract.balanceOf(starknetAccount.address);
        const balance = BigInt(balanceRaw.toString());

        if (balance === 0n) {
          throw new Error(
            "No token balance available to deposit. The swap may not have completed yet."
          );
        }

        // Use the lesser of requested amount and actual balance
        const depositAmount = assetsValue > balance ? balance : assetsValue;

        // Only approve if current allowance is insufficient
        const allowanceRaw = await assetContract.allowance(starknetAccount.address, vTokenAddress);
        const allowance = BigInt(allowanceRaw.toString());
        if (allowance < depositAmount) {
          const approveResult = await assetContract.approve(vTokenAddress, depositAmount);
          await provider.waitForTransaction(approveResult.transaction_hash);
        }

        // Deposit assets into the vToken vault
        const receiver = starknetAccount.address;
        const result = await contract.deposit(depositAmount, receiver);
        await provider.waitForTransaction(result.transaction_hash);

        return result.transaction_hash;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to deposit";
        setError(message);
        throw new Error(message);
      } finally {
        setIsDepositing(false);
      }
    },
    [starknetAccount]
  );

  return { deposit, isDepositing, error };
}
