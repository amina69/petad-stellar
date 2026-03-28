import { Keypair } from '@stellar/stellar-sdk';
import { CreateEscrowParams, EscrowAccount, Signer, Thresholds } from '../types/escrow';
import { getMinimumReserve } from '../accounts';
import { InsufficientBalanceError, ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';

/**
 * Calculate the required starting balance for an escrow account.
 * Formula: minimum reserve for 3 signers + deposit amount
 *
 * @param depositAmount - The deposit amount as a string
 * @returns The total starting balance as a string in XLM
 */
export function calculateStartingBalance(depositAmount: string): string {
  if (!isValidAmount(depositAmount)) {
    throw new ValidationError('depositAmount', `Invalid deposit amount: ${depositAmount}`);
  }

  const minimumReserve = parseFloat(getMinimumReserve(3, 0, 0)); // 3 signers for escrow
  const deposit = parseFloat(depositAmount);
  const totalBalance = minimumReserve + deposit;

  // Format to 7 decimal places (Stellar precision) and strip trailing zeros
  return totalBalance.toFixed(7).replace(/\.?0+$/, '');
}

/**
 * Create a new escrow account with the specified parameters.
 * This is the second step in the escrow lifecycle - funding the account.
 *
 * @param params - The parameters for creating the escrow account
 * @param accountManager - The account manager instance for creating accounts
 * @returns The created escrow account reference
 * @throws {ValidationError} If input parameters are invalid
 * @throws {InsufficientBalanceError} If the master account has insufficient balance
 */
export async function createEscrowAccount(
  params: CreateEscrowParams,
  accountManager: {
    create: (args: {
      publicKey: string;
      startingBalance: string;
    }) => Promise<{ accountId: string; transactionHash: string }>;
    getBalance: (publicKey: string) => Promise<string>;
  },
): Promise<EscrowAccount> {
  // Validate input parameters
  if (!isValidPublicKey(params.adopterPublicKey)) {
    throw new ValidationError('adopterPublicKey', `Invalid public key: ${params.adopterPublicKey}`);
  }

  if (!isValidPublicKey(params.ownerPublicKey)) {
    throw new ValidationError('ownerPublicKey', `Invalid public key: ${params.ownerPublicKey}`);
  }

  if (!isValidAmount(params.depositAmount)) {
    throw new ValidationError('depositAmount', `Invalid amount: ${params.depositAmount}`);
  }

  // Generate a new keypair for the escrow account
  const escrowKeypair = Keypair.random();
  const escrowPublicKey = escrowKeypair.publicKey();

  // Calculate required starting balance
  const startingBalance = calculateStartingBalance(params.depositAmount);

  try {
    // Create the escrow account with the calculated starting balance
    const result = await accountManager.create({
      publicKey: escrowPublicKey,
      startingBalance,
    });

    // Set up the escrow signers and thresholds
    // Platform + Adopter + Owner = 3 signers with 2-of-3 multisig
    const signers: Signer[] = [
      { publicKey: escrowPublicKey, weight: 1 }, // Master key initially has weight 1
      { publicKey: params.adopterPublicKey, weight: 1 },
      { publicKey: params.ownerPublicKey, weight: 1 },
      // Platform signer would be added here with weight 1
    ];

    const thresholds: Thresholds = {
      low: 1,
      medium: 2,
      high: 2,
    };

    return {
      accountId: result.accountId,
      transactionHash: result.transactionHash,
      signers,
      thresholds,
      unlockDate: params.unlockDate,
    };
  } catch (error) {
    // Handle InsufficientBalanceError from master account
    if (error instanceof InsufficientBalanceError) {
      throw error;
    }
    // Re-throw other errors
    throw error;
  }
}

// Placeholder functions for other escrow operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown {
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown {
  return undefined;
}
