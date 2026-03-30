
export function buildMultisigTransaction(): void {
  // placeholder function
  return;
}

export async function fetchTransactionOnce(hash: string) {
  const url = `https://horizon-testnet.stellar.org/transactions/${hash}`;

  try {
    const res = await fetch(url);

    if (res.status === 404) {
      return { found: false };
    }

    if (!res.ok) {
      throw new Error("Horizon error");
    }

    const data = (await res.json()) as {
  successful: boolean;
  ledger: number;
  created_at: string;
};

    return {
      found: true,
      successful: data.successful,
      ledger: data.ledger,
      createdAt: data.created_at,
    };
  } catch {
    // ✅ fixed: removed unused "err"
    throw new Error("HorizonSubmitError");
  }
}


import { HorizonSubmitError } from '../utils/errors';
import { TESTNET_HORIZON_URL } from '../utils/constants';

/**
 * Internal: Fetch a single transaction status from Horizon by hash.
 * @param hash Transaction hash
 * @returns {Promise<{found: true, successful: boolean, ledger: number, createdAt: string} | {found: false}>}
 * @throws {HorizonSubmitError} On network error
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
		const data: unknown = await res.json();
		if (
			typeof data === 'object' && data !== null &&
			'successful' in data && 'ledger' in data && 'created_at' in data
		) {
			return {
				found: true,
				successful: Boolean((data as { successful: unknown }).successful),
				ledger: Number((data as { ledger: unknown }).ledger),
				createdAt: (data as { created_at: string }).created_at,
			};
		}
		throw new HorizonSubmitError('horizon_invalid_response');
	} catch {
		// Only throw for network errors
		throw new HorizonSubmitError('network_error');
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }

