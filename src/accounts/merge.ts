import * as StellarSdk from '@stellar/stellar-sdk';
import { ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidSecretKey } from '../utils/validation';
import { logger } from '../utils/logger';

export interface MergeAccountParams {
  escrowAccountId: string;
  destinationAccountId: string;
}

export interface MergeAccountResult {
  mergedAccountId: string;
  txHash: string;
}

export class TrustlineError extends Error {
  constructor(public readonly accountId: string) {
    super(
      `Cannot merge account ${accountId}: account has non-native trustlines that must be removed first`,
    );
    this.name = 'TrustlineError';
  }
}

/**
 * Merge a settled escrow account back into the destination account
 * to recover the minimum reserve XLM.
 *
 * @throws {ValidationError} if keys are invalid
 * @throws {TrustlineError} if the escrow account has non-native trustlines
 */
export async function mergeAccount(
  params: MergeAccountParams,
  masterSecretKey: string,
  horizonUrl: string,
  networkPassphrase: string,
): Promise<MergeAccountResult> {
  const { escrowAccountId, destinationAccountId } = params;

  // Validate keys
  if (!isValidPublicKey(escrowAccountId)) {
    throw new ValidationError('escrowAccountId', 'Invalid escrow account public key');
  }
  if (!isValidPublicKey(destinationAccountId)) {
    throw new ValidationError('destinationAccountId', 'Invalid destination account public key');
  }
  if (!isValidSecretKey(masterSecretKey)) {
    throw new ValidationError('masterSecretKey', 'Invalid master secret key');
  }

  const server = new StellarSdk.Horizon.Server(horizonUrl);
  const masterKeypair = StellarSdk.Keypair.fromSecret(masterSecretKey);

  // Load escrow account to check for non-native trustlines
  const escrowAccount = await server.loadAccount(escrowAccountId);
  const nonNativeTrustlines = escrowAccount.balances.filter(
    (b: StellarSdk.Horizon.HorizonApi.BalanceLine) => b.asset_type !== 'native',
  );

  if (nonNativeTrustlines.length > 0) {
    throw new TrustlineError(escrowAccountId);
  }

  logger.info(`Merging escrow ${escrowAccountId} into ${destinationAccountId}`);

  // Build AccountMerge transaction
  const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.accountMerge({
        destination: destinationAccountId,
      }),
    )
    .setTimeout(180)
    .build();

  // Sign with master key (platform holds weight for medium threshold)
  tx.sign(masterKeypair);

  // Submit
  const result = await server.submitTransaction(tx);

  logger.info(`Account merge successful: ${result.hash}`);

  return {
    mergedAccountId: escrowAccountId,
    txHash: result.hash,
  };
}
