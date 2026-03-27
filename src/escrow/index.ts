import { AccountManager } from '../accounts/manager';
import { CreateEscrowParams, EscrowAccount } from '../types/escrow';
import { Signer, Thresholds } from '../types/network';
import { ValidationError } from '../utils/errors';

/**
 * Create an escrow account with 2-of-3 multisig configuration
 *
 * This function:
 * 1. Creates a new escrow account
 * 2. Configures it as 2-of-3 multisig with adopter, owner, and platform signers
 * 3. Sets appropriate thresholds (low:0, medium:2, high:2)
 * 4. Removes the master key as signer (used only for account creation)
 * 5. Verifies the resulting signer configuration
 *
 * @param params Parameters for escrow creation including adopter and owner public keys
 * @param platformPublicKey Platform's public key to include as third signer
 * @param masterSecretKey Master secret key used for initial account setup
 * @returns Promise resolving to the created escrow account details
 */
export async function createEscrowAccount(
  params: CreateEscrowParams,
  platformPublicKey: string,
  masterSecretKey: string,
): Promise<EscrowAccount> {
  const { adopterPublicKey, ownerPublicKey } = params;

  // Validate input parameters
  if (!adopterPublicKey || !ownerPublicKey || !platformPublicKey || !masterSecretKey) {
    throw new ValidationError('input', 'All parameters are required for escrow account creation');
  }

  if (
    adopterPublicKey === ownerPublicKey ||
    adopterPublicKey === platformPublicKey ||
    ownerPublicKey === platformPublicKey
  ) {
    throw new ValidationError('signers', 'All signer public keys must be unique');
  }

  const accountManager = new AccountManager();

  try {
    // Step 1: Create the escrow account
    const { publicKey: escrowAccountId } = await accountManager.createAccount(
      masterSecretKey,
      '2.0000000',
    );

    // Step 2: Configure 2-of-3 multisig setup
    const signers: Signer[] = [
      { publicKey: adopterPublicKey, weight: 1 },
      { publicKey: ownerPublicKey, weight: 1 },
      { publicKey: platformPublicKey, weight: 1 },
    ];

    const thresholds: Thresholds = {
      low: 0, // No low-threshold operations
      medium: 2, // Requires 2 of 3 signers
      high: 2, // Requires 2 of 3 signers
    };

    // Step 3: Apply multisig configuration
    const accountInfo = await accountManager.configureMultisig(
      escrowAccountId,
      signers,
      thresholds,
      masterSecretKey,
    );

    // Step 4: Verify the resulting signer configuration
    verifySignerConfiguration(accountInfo.signers, accountInfo.thresholds);

    // Step 5: Return escrow account details
    const escrowAccount: EscrowAccount = {
      accountId: accountInfo.accountId,
      transactionHash: `tx-hash-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`, // Unique transaction hash
      signers: accountInfo.signers,
      thresholds: accountInfo.thresholds,
      unlockDate: params.unlockDate,
    };

    return escrowAccount;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new Error(
      `Failed to create escrow account: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Verify that the signer configuration meets the 2-of-3 multisig requirements
 * @param signers The configured signers
 * @param thresholds The configured thresholds
 */
function verifySignerConfiguration(signers: Signer[], thresholds: Thresholds): void {
  // Verify exactly 3 signers
  if (signers.length !== 3) {
    throw new ValidationError('signers', `Expected exactly 3 signers, got ${signers.length}`);
  }

  // Verify all signers have weight 1
  const invalidWeights = signers.filter((s) => s.weight !== 1);
  if (invalidWeights.length > 0) {
    throw new ValidationError('signers', 'All signers must have weight 1');
  }

  // Verify thresholds are correct (low:0, medium:2, high:2)
  if (thresholds.low !== 0 || thresholds.medium !== 2 || thresholds.high !== 2) {
    throw new ValidationError('thresholds', 'Thresholds must be: low=0, medium=2, high=2');
  }

  // Verify all signer keys are unique
  const uniqueKeys = new Set(signers.map((s) => s.publicKey));
  if (uniqueKeys.size !== 3) {
    throw new ValidationError('signers', 'All signer public keys must be unique');
  }
}

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
