// -----------------------------
// Core Types
// -----------------------------

export type Signer = {
  publicKey: string;
  weight: number;
};

export type Thresholds = {
  low: number;
  medium: number;
  high: number;
};

// -----------------------------
// Create Escrow
// -----------------------------

export type CreateEscrowParams = {
  adopterPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  unlockDate?: Date;
};

export type EscrowAccount = {
  accountId: string;
  transactionHash: string;
  signers: Signer[];
  thresholds: Thresholds;
  unlockDate?: Date;
};

// -----------------------------
// Distribution + Release (MATCH TESTS)
// -----------------------------

export type Distribution = {
  recipient: string;
  percentage: number;
};

export type ReleaseParams = {
  escrowAccountId: string;
  distribution: Distribution[];
};

export type ReleasedPayment = {
  recipient: string;
  amount: string;
};

export type ReleaseResult = {
  successful: boolean;
  txHash: string;
  ledger: number;
  payments?: ReleasedPayment[];
};

// -----------------------------
// Utility Types
// -----------------------------

export type Percentage = number;

export enum EscrowStatus {
  CREATED = "CREATED",
  FUNDED = "FUNDED",
  DISPUTED = "DISPUTED",
  SETTLING = "SETTLING",
  SETTLED = "SETTLED",
  NOT_FOUND = "NOT_FOUND",
}

export function asPercentage(value: number): Percentage {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Percentage must be between 0 and 100, got ${value}`);
  }

  if (value < 0 || value > 100) {
    throw new RangeError(`Percentage must be between 0 and 100, got ${value}`);
  }

  return value;
}

// -----------------------------
// Lock Custody (your feature)
// -----------------------------

export type LockCustodyFundsParams = {
  custodianPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  durationDays: number;
};

export type LockResult = {
  escrowAccountId: string;
  unlockDate: Date;
  conditionsHash: string;
};