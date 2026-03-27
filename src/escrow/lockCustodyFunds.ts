import crypto from 'crypto';
import {
  Keypair,
  TransactionBuilder,
  Operation,
  Memo,
  Networks,
  BASE_FEE,
  Account,
  Transaction,
} from '@stellar/stellar-sdk';

// ── Re-use the repo's own types ──────────────────────────────────────────────
import type { Signer, Thresholds } from '../types/escrow';

// ── Input / Output types ─────────────────────────────────────────────────────

export interface LockCustodyFundsParams {
  custodianPublicKey: string;
  ownerPublicKey:     string;
  platformPublicKey:  string;
  depositAmount:      string;   // e.g. "100.00"
  durationDays:       number;
  /** Stellar Account object used as the transaction source (platform-funded) */
  escrowAccount:      Account;
  networkPassphrase?: string;
}

export interface LockResult {
  unlockDate:      Date;
  conditionsHash:  string;
  transaction:     Transaction;
  escrowPublicKey: string;
  signers:         Signer[];
  thresholds:      Thresholds;
}

interface ConditionsInput {
  noViolations: boolean;
  petReturned:  boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministically SHA-256 hash a conditions object.
 * Keys are sorted so insertion order never affects the output.
 */
export function hashData(conditions: ConditionsInput): string {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(conditions).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** Validate a Stellar G… public key without throwing uncontrolled errors. */
function isValidPublicKey(key: string): boolean {
  try {
    Keypair.fromPublicKey(key);
    return true;
  } catch {
    return false;
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Lock a deposit in a custody escrow.
 *
 * Builds a Stellar transaction that:
 *  1. Creates a fresh escrow account funded with `depositAmount`
 *  2. Adds custodian, owner and platform as signers (weight 1 each)
 *  3. Sets master weight to 0 and all thresholds to 2 (2-of-3 multisig)
 *  4. Encodes the first 28 chars of `conditionsHash` as a TEXT memo
 *
 * The returned `transaction` must be signed by the appropriate parties
 * and submitted to Horizon by the caller.
 */
export function lockCustodyFunds(params: LockCustodyFundsParams): LockResult {
  const {
    custodianPublicKey,
    ownerPublicKey,
    platformPublicKey,
    depositAmount,
    durationDays,
    escrowAccount,
    networkPassphrase = Networks.TESTNET,
  } = params;

  // ── 1. Validate inputs ────────────────────────────────────────────────────

  if (!custodianPublicKey || !isValidPublicKey(custodianPublicKey)) {
    throw new Error('Invalid custodianPublicKey');
  }
  if (!ownerPublicKey || !isValidPublicKey(ownerPublicKey)) {
    throw new Error('Invalid ownerPublicKey');
  }
  if (!platformPublicKey || !isValidPublicKey(platformPublicKey)) {
    throw new Error('Invalid platformPublicKey');
  }

  const amount = parseFloat(depositAmount);
  if (isNaN(amount) || amount <= 0) {
    throw new Error('depositAmount must be a positive number');
  }

  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new Error('durationDays must be a positive integer');
  }

  // ── 2. Compute conditionsHash ─────────────────────────────────────────────

  const conditionsHash = hashData({ noViolations: true, petReturned: true });

  // ── 3. Compute unlockDate ─────────────────────────────────────────────────

  const unlockDate = new Date(Date.now() + durationDays * 86_400_000);

  // ── 4. Fresh escrow keypair ───────────────────────────────────────────────

  const escrowKeypair   = Keypair.random();
  const escrowPublicKey = escrowKeypair.publicKey();

  // ── 5. Build signers / thresholds (typed via repo's Signer / Thresholds) ──

  const signers: Signer[] = [
    { publicKey: custodianPublicKey, weight: 1 },
    { publicKey: ownerPublicKey,     weight: 1 },
    { publicKey: platformPublicKey,  weight: 1 },
  ];

  const thresholds: Thresholds = { low: 2, medium: 2, high: 2 };

  // ── 6. Build Stellar transaction ──────────────────────────────────────────

  // Memo: first 28 hex chars of conditionsHash (Stellar TEXT memo max = 28 bytes)
  const memoText = conditionsHash.substring(0, 28);

  const transaction = new TransactionBuilder(escrowAccount, {
    fee:               BASE_FEE,
    networkPassphrase,
  })
    // Create the escrow account, funded with the deposit
    .addOperation(
      Operation.createAccount({
        destination:     escrowPublicKey,
        startingBalance: depositAmount,
      }),
    )
    // Add custodian as signer
    .addOperation(
      Operation.setOptions({
        source: escrowPublicKey,
        signer: { ed25519PublicKey: custodianPublicKey, weight: 1 },
      }),
    )
    // Add owner as signer
    .addOperation(
      Operation.setOptions({
        source: escrowPublicKey,
        signer: { ed25519PublicKey: ownerPublicKey, weight: 1 },
      }),
    )
    // Add platform as signer + configure 2-of-3 thresholds
    // masterWeight 0 prevents the escrow keypair from signing alone
    .addOperation(
      Operation.setOptions({
        source:       escrowPublicKey,
        signer:       { ed25519PublicKey: platformPublicKey, weight: 1 },
        masterWeight: 0,
        lowThreshold:  thresholds.low,
        medThreshold:  thresholds.medium,
        highThreshold: thresholds.high,
      }),
    )
    .addMemo(Memo.text(memoText))
    .setTimeout(180)
    .build();

  return {
    unlockDate,
    conditionsHash,
    transaction,
    escrowPublicKey,
    signers,
    thresholds,
  };
}