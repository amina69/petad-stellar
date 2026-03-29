import { Keypair, Horizon, TransactionBuilder, Operation, Networks, Memo } from '@stellar/stellar-sdk';
import { CreateEscrowParams, EscrowAccount, Signer, Thresholds } from '../types/escrow';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { ValidationError, SdkError, FriendbotError } from '../utils/errors';
import {
  TESTNET_HORIZON_URL,
  DEFAULT_TRANSACTION_TIMEOUT,
  DEFAULT_MAX_FEE,
} from '../utils/constants';

/**
 * Cache for tracking created escrow accounts to ensure idempotency.
 * Maps a composite key (adopterPublicKey:ownerPublicKey:depositAmount) to the created EscrowAccount.
 */
const escrowCache = new Map<string, EscrowAccount>();

/**
 * Generates a unique cache key for idempotency checking.
 * @param params - The escrow creation parameters
 * @returns A composite key string
 */
function generateCacheKey(params: CreateEscrowParams): string {
  return `${params.adopterPublicKey}:${params.ownerPublicKey}:${params.depositAmount}`;
}

/**
 * Checks if an escrow account has already been created with the same parameters.
 * @param params - The escrow creation parameters
 * @returns The existing EscrowAccount if found, undefined otherwise
 */
function checkIdempotency(params: CreateEscrowParams): EscrowAccount | undefined {
  const key = generateCacheKey(params);
  return escrowCache.get(key);
}

/**
 * Generates a new Stellar keypair for the escrow account.
 * @returns A Stellar Keypair object
 */
function generateEscrowKeypair(): Keypair {
  return Keypair.random();
}

/**
 * Funds a new account using Stellar's Friendbot (testnet only).
 * @param publicKey - The public key of the account to fund
 * @throws {FriendbotError} If funding fails
 */
async function fundAccountWithFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );

  if (!response.ok) {
    throw new FriendbotError(publicKey, response.status);
  }
}

/**
 * Configures multisig on the escrow account with adopter and owner as signers.
 * Sets thresholds to require both parties for high-security operations.
 * @param escrowKeypair - The escrow account keypair
 * @param adopterPublicKey - The adopter's public key
 * @param ownerPublicKey - The owner's public key
 * @param server - The Horizon server instance
 * @returns The transaction hash and configured signers/thresholds
 */
async function configureMultisig(
  escrowKeypair: Keypair,
  adopterPublicKey: string,
  ownerPublicKey: string,
  server: Horizon.Server
): Promise<{ txHash: string; signers: Signer[]; thresholds: Thresholds }> {
  const escrowAccount = await server.loadAccount(escrowKeypair.publicKey());

  const transaction = new TransactionBuilder(escrowAccount, {
    fee: DEFAULT_MAX_FEE.toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.setOptions({
        signer: { ed25519PublicKey: adopterPublicKey, weight: 1 },
      })
    )
    .addOperation(
      Operation.setOptions({
        signer: { ed25519PublicKey: ownerPublicKey, weight: 1 },
      })
    )
    .addOperation(
      Operation.setOptions({
        masterWeight: 1,
        lowThreshold: 1,
        medThreshold: 2,
        highThreshold: 2,
      })
    )
    .setTimeout(DEFAULT_TRANSACTION_TIMEOUT)
    .build();

  transaction.sign(escrowKeypair);

  const result = await server.submitTransaction(transaction);

  const signers: Signer[] = [
    { publicKey: escrowKeypair.publicKey(), weight: 1 },
    { publicKey: adopterPublicKey, weight: 1 },
    { publicKey: ownerPublicKey, weight: 1 },
  ];

  const thresholds: Thresholds = {
    low: 1,
    medium: 2,
    high: 2,
  };

  return {
    txHash: result.hash,
    signers,
    thresholds,
  };
}

/**
 * Encodes adoption metadata into a transaction memo.
 * @param metadata - Optional metadata containing adoptionId and petId
 * @returns A Stellar Memo object
 */
function encodeMemo(metadata?: { adoptionId: string; petId: string }): Memo {
  if (!metadata) {
    return Memo.none();
  }

  // Create a compact memo string with adoption info
  const memoText = `adopt:${metadata.adoptionId.slice(0, 10)}:${metadata.petId.slice(0, 10)}`;
  return Memo.text(memoText.slice(0, 28)); // Stellar memo text limit is 28 bytes
}

/**
 * Creates a new escrow account on the Stellar network for pet adoption transactions.
 *
 * This function performs the complete escrow account creation lifecycle:
 * 1. Validates all input parameters
 * 2. Checks for idempotency (returns existing account if already created)
 * 3. Generates a new Stellar keypair for the escrow
 * 4. Funds the account using Friendbot (testnet)
 * 5. Configures multisig with adopter and owner as signers
 * 6. Encodes optional metadata as a memo
 *
 * @param params - The parameters for creating the escrow account
 * @param params.adopterPublicKey - The Stellar public key of the adopter (must start with 'G', 56 chars)
 * @param params.ownerPublicKey - The Stellar public key of the pet owner (must start with 'G', 56 chars)
 * @param params.depositAmount - The deposit amount in XLM as a string (must be positive, max 7 decimals)
 * @param params.adoptionFee - Optional adoption fee in XLM
 * @param params.unlockDate - Optional date when funds can be released
 * @param params.metadata - Optional metadata containing adoptionId and petId
 *
 * @returns A Promise resolving to the complete EscrowAccount object containing:
 *   - accountId: The public key of the created escrow account
 *   - transactionHash: The hash of the multisig configuration transaction
 *   - signers: Array of signers with their weights
 *   - thresholds: The configured threshold levels (low, medium, high)
 *   - unlockDate: The unlock date if provided
 *
 * @throws {ValidationError} If adopterPublicKey is invalid (field: 'adopterPublicKey')
 * @throws {ValidationError} If ownerPublicKey is invalid (field: 'ownerPublicKey')
 * @throws {ValidationError} If depositAmount is invalid (field: 'depositAmount')
 * @throws {FriendbotError} If account funding fails on testnet
 * @throws {SdkError} If any other error occurs during account creation
 *
 * @example
 * ```typescript
 * import { createEscrowAccount } from '@petad/stellar-sdk';
 *
 * const escrow = await createEscrowAccount({
 *   adopterPublicKey: 'GADOPTER...', // 56-char Stellar public key
 *   ownerPublicKey: 'GOWNER...',     // 56-char Stellar public key
 *   depositAmount: '100.0000000',    // XLM amount
 *   metadata: {
 *     adoptionId: 'adopt-123',
 *     petId: 'pet-456',
 *   },
 * });
 *
 * console.log(escrow.accountId);      // The escrow's public key
 * console.log(escrow.transactionHash); // Multisig setup tx hash
 * console.log(escrow.signers);         // [{ publicKey, weight }, ...]
 * console.log(escrow.thresholds);      // { low: 1, medium: 2, high: 2 }
 * ```
 */
export async function createEscrowAccount(
  params: CreateEscrowParams
): Promise<EscrowAccount> {
  try {
    // Step 1: Validate adopterPublicKey
    if (!isValidPublicKey(params.adopterPublicKey)) {
      throw new ValidationError(
        'adopterPublicKey',
        'Invalid adopter public key. Must be a valid Stellar public key starting with G and 56 characters long.'
      );
    }

    // Step 2: Validate ownerPublicKey
    if (!isValidPublicKey(params.ownerPublicKey)) {
      throw new ValidationError(
        'ownerPublicKey',
        'Invalid owner public key. Must be a valid Stellar public key starting with G and 56 characters long.'
      );
    }

    // Step 3: Validate depositAmount
    if (!isValidAmount(params.depositAmount)) {
      throw new ValidationError(
        'depositAmount',
        'Invalid deposit amount. Must be a positive number with at most 7 decimal places.'
      );
    }

    // Step 4: Run idempotency check
    const existingEscrow = checkIdempotency(params);
    if (existingEscrow) {
      return existingEscrow;
    }

    // Step 5: Generate escrow keypair
    const escrowKeypair = generateEscrowKeypair();

    // Step 6: Fund the escrow account
    await fundAccountWithFriendbot(escrowKeypair.publicKey());

    // Step 7: Configure multisig
    const server = new Horizon.Server(TESTNET_HORIZON_URL);
    const { txHash, signers, thresholds } = await configureMultisig(
      escrowKeypair,
      params.adopterPublicKey,
      params.ownerPublicKey,
      server
    );

    // Step 8: Encode memo (for future transaction use)
    encodeMemo(params.metadata);

    // Step 9: Build the complete EscrowAccount object
    const escrowAccount: EscrowAccount = {
      accountId: escrowKeypair.publicKey(),
      transactionHash: txHash,
      signers,
      thresholds,
      unlockDate: params.unlockDate,
    };

    // Step 10: Cache for idempotency
    const cacheKey = generateCacheKey(params);
    escrowCache.set(cacheKey, escrowAccount);

    return escrowAccount;
  } catch (error) {
    // Re-throw SdkError subclasses as-is
    if (error instanceof SdkError) {
      throw error;
    }

    // Wrap unknown errors in SdkError
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new SdkError(
      `Failed to create escrow account: ${message}`,
      'ESCROW_CREATION_ERROR',
      false
    );
  }
}

/**
 * Clears the escrow cache. Useful for testing.
 * @internal
 */
export function clearEscrowCache(): void {
  escrowCache.clear();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown { return undefined; }
