import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { ValidationError } from '../utils/errors';
import { TESTNET_PASSPHRASE } from '../utils/constants';

/**
 * Serialise a transaction to XDR string for storage.
 * @param tx The transaction to serialise.
 * @returns The XDR string.
 */
export function transactionToXDR(tx: Transaction): string {
  return tx.toXDR();
}

/**
 * Deserialise an XDR string back to a Transaction object.
 * @param xdr The XDR string to deserialise.
 * @param networkPassphrase The network passphrase (defaults to Testnet).
 * @returns The Transaction object.
 * @throws ValidationError if the XDR is invalid or empty.
 */
export function transactionFromXDR(
  xdr: string,
  networkPassphrase = TESTNET_PASSPHRASE,
): Transaction {
  if (!xdr || typeof xdr !== 'string' || xdr.trim().length === 0) {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }

  try {
    return TransactionBuilder.fromXDR(xdr, networkPassphrase) as Transaction;
  } catch (error) {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }
}
