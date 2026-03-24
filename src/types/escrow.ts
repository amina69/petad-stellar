import { Signer, Thresholds } from './network';

export { Signer, Thresholds };

export interface CreateEscrowParams {
  adopterPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  adoptionFee?: string;
  unlockDate?: Date;
  metadata?: { adoptionId: string; petId: string };
}

export interface EscrowAccount {
  accountId: string;
  transactionHash: string;
  signers: Signer[];
  thresholds: Thresholds;
  unlockDate?: Date;
}

export enum EscrowStatus {
  CREATED   = 'CREATED',
  FUNDED    = 'FUNDED',
  DISPUTED  = 'DISPUTED',
  SETTLING  = 'SETTLING',
  SETTLED   = 'SETTLED',
  NOT_FOUND = 'NOT_FOUND',
}

// ---------------------------------------------------------------------------
// Branded type: Percentage
// Ensures Distribution.percentage is constrained to 0-100 at the type level.
// Use `asPercentage()` to create a validated value at runtime.
// ---------------------------------------------------------------------------

/** A number branded to signal it has been validated as 0 ≤ n ≤ 100. */
export type Percentage = number & { readonly __brand: 'Percentage' };

/**
 * Validates and casts a plain number to a `Percentage` branded type.
 * Rejects NaN, Infinity, -Infinity, and any value outside [0, 100].
 * @throws {RangeError} if value is not a finite number in [0, 100].
 */
export function asPercentage(value: number): Percentage {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError(
      `Percentage must be between 0 and 100, got ${value}`,
    );
  }
  return value as Percentage;
}

// ---------------------------------------------------------------------------
// Escrow release / settlement types (Issue #34)
// ---------------------------------------------------------------------------

/** A single recipient and their share of the escrow release. */
export interface Distribution {
  recipient: string;
  percentage: Percentage;
}

/** Parameters required to trigger an escrow release settlement. */
export interface ReleaseParams {
  escrowAccountId: string;
  distribution: Distribution[];
}

/** Recorded payment made to a recipient during settlement. */
export interface ReleasedPayment {
  recipient: string;
  amount: string;
}

/** Result returned after an escrow release transaction is submitted. */
export interface ReleaseResult {
  successful: boolean;
  txHash: string;
  ledger: number;
  payments: ReleasedPayment[];
}

export interface DisputeParams {
  escrowAccountId: string;
}

export interface DisputeResult {
  accountId:        string;
  pausedAt:         Date;
  platformOnlyMode: true;
  txHash:           string;
}
