import {
  Keypair,
  Networks,
  Server,
  TransactionBuilder,
  Operation,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { MultisigConfig, validateMultisigConfig } from './validation';

export interface MultisigResult {
  accountId: string;
  transactionHash: string;
}

/**
 * Builds, signs, and submits a SetOptions transaction that configures
 * multi-signature on a Stellar account.
 *
 * A single TransactionBuilder with a single SetOptions operation is used so
 * that all signers and thresholds are applied atomically on-chain.
 *
 * @param config - The multisig configuration (signers, thresholds, masterKey).
 * @param server  - A horizon Server instance (injectable for testing).
 * @param networkPassphrase - Stellar network passphrase (defaults to Testnet).
 * @returns {Promise<MultisigResult>} accountId and the resulting transaction hash.
 */
export async function configureMultisig(
  config: MultisigConfig,
  server: Server,
  networkPassphrase: string = Networks.TESTNET
): Promise<MultisigResult> {
  const { accountId, signers, thresholds, masterKey } = config;

  // --- Step 1: Validate inputs ---
  validateMultisigConfig(config);

  // --- Step 2: Load account from network ---
  const account = await server.loadAccount(accountId);

  // --- Step 3: Build ONE transaction with SetOptions operations ---
  const transactionBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  // Add thresholds in the first SetOptions operation
  transactionBuilder.addOperation(
    Operation.setOptions({
      lowThreshold: thresholds.low,
      medThreshold: thresholds.medium,
      highThreshold: thresholds.high,
    })
  );

  // Add each signer via additional SetOptions calls on the
  // same TransactionBuilder (all in one transaction envelope).
  for (const signer of signers) {
    transactionBuilder.addOperation(
      Operation.setOptions({
        signer: {
          ed25519PublicKey: signer.publicKey,
          weight: signer.weight,
        },
      })
    );
  }

  const transaction = transactionBuilder.setTimeout(30).build();

  // --- Step 4: Sign with master key ---
  const masterKeypair = Keypair.fromSecret(masterKey);
  transaction.sign(masterKeypair);

  // --- Step 5: Submit transaction ---
  const result = await server.submitTransaction(transaction);

  return {
    accountId,
    transactionHash: result.hash,
  };
}
