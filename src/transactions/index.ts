import { Transaction, TransactionBuilder as StellarTransactionBuilder } from '@stellar/stellar-sdk';
import { HorizonSubmitError, ValidationError } from '../utils/errors';
import { TESTNET_HORIZON_URL } from '../utils/constants';

export { buildSetOptionsOp } from './builder';
export { buildCreateAccountOp } from './operations';
export { submitTransaction } from './submission';

/**
 * Serialise a transaction to XDR string.
 * @param tx Transaction to serialise
 * @returns {string} XDR string
 */
export function transactionToXDR(tx: Transaction): string {
  return tx.toXDR();
}

/**
 * Deserialise a transaction from XDR string.
 * @param xdr XDR string to deserialise
 * @returns {Transaction} Deserialised transaction
 * @throws {ValidationError} If XDR is invalid or empty
 */
export function transactionFromXDR(xdr: string): Transaction {
  if (!xdr || typeof xdr !== 'string') {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }

  try {
    return StellarTransactionBuilder.fromXDR(xdr, TESTNET_HORIZON_URL) as Transaction;
  } catch (error) {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }
}

/**
 * Internal: Fetch a single transaction status from Horizon by hash.
 */
export async function fetchTransactionOnce(hash: string): Promise<
	| { found: true; successful: boolean; ledger: number; createdAt: string }
	| { found: false }
> {
	const url = `${TESTNET_HORIZON_URL}/transactions/${hash}`;
	try {
		const res = await fetch(url);
		if (res.status === 404) {
			return { found: false };
		}
		if (!res.ok) {
			throw new HorizonSubmitError(`horizon_http_${res.status}`);
		}
		// Use unknown and type guard for data
		const data: any = await res.json();
		if (
			typeof data === 'object' && data !== null &&
			'successful' in data && 'ledger' in data && 'created_at' in data
		) {
			return {
				found: true,
				successful: Boolean(data.successful),
				ledger: Number(data.ledger),
				createdAt: data.created_at,
			};
		}
		throw new HorizonSubmitError('horizon_invalid_response');
	} catch {
		// Only throw for network errors
		throw new HorizonSubmitError('network_error');
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: any[]): any { return undefined; }
