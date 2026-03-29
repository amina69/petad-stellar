import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { ValidationError } from '../utils/errors';
import { isValidSecretKey } from '../utils/validation';

export function buildMultisigTransaction(
  transaction: Transaction,
  secretKeys: string[],
): Transaction {
  if (!Array.isArray(secretKeys) || secretKeys.length === 0) {
    throw new ValidationError('secretKeys', 'At least one secret key is required');
  }

  for (const secretKey of secretKeys) {
    if (!isValidSecretKey(secretKey)) {
      throw new ValidationError('secretKeys', 'Invalid secret key provided');
    }
  }

  for (const secretKey of secretKeys) {
    const signer = Keypair.fromSecret(secretKey);
    transaction.sign(signer);
  }

  return transaction;
}
