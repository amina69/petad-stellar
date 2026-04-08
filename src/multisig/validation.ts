import { StrKey } from '@stellar/stellar-sdk';

export interface SignerConfig {
  publicKey: string;
  weight: number;
}

export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

export interface MultisigConfig {
  accountId: string;
  signers: SignerConfig[];
  thresholds: Thresholds;
  masterKey: string;
}

/**
 * Custom error class for validation failures in configureMultisig.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    // Restore prototype chain for instanceof checks (TypeScript / ES5 target)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates the multisig configuration before building a transaction.
 *
 * Rules:
 *  - Every signer.publicKey must be a valid Ed25519 public key.
 *  - masterKey must be a valid Ed25519 public key (used later as a secret).
 *  - The sum of all signer weights must be strictly greater than thresholds.high.
 *
 * @throws {ValidationError} when any rule is violated.
 */
export function validateMultisigConfig(config: MultisigConfig): void {
  const { signers, thresholds, masterKey } = config;

  // Validate master key
  if (!StrKey.isValidEd25519PublicKey(masterKey)) {
    throw new ValidationError(
      `Invalid masterKey: "${masterKey}" is not a valid Ed25519 public key.`
    );
  }

  // Validate each signer public key
  for (const signer of signers) {
    if (!StrKey.isValidEd25519PublicKey(signer.publicKey)) {
      throw new ValidationError(
        `Invalid signer publicKey: "${signer.publicKey}" is not a valid Ed25519 public key.`
      );
    }
  }

  // Ensure total signer weight exceeds high threshold
  const totalWeight = signers.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= thresholds.high) {
    throw new ValidationError(
      `Insufficient signer weight: total weight (${totalWeight}) must be greater than ` +
        `the high threshold (${thresholds.high}).`
    );
  }
}
