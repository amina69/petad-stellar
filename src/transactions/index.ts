import { TESTNET_HORIZON_URL } from '../utils/constants';
import { MonitorTimeoutError } from '../utils/errors';
import type { TransactionStatus } from '../types/transaction';

export interface MonitorTransactionOptions {
	maxAttempts?: number;
	intervalMs?: number;
}

interface FetchTransactionFoundResult {
	status: 'confirmed' | 'failed';
	hash: string;
	txLedger: number;
	currentLedger: number;
	successful: boolean;
}

interface FetchTransactionNotFoundResult {
	status: 'not_found';
}

type FetchTransactionResult = FetchTransactionFoundResult | FetchTransactionNotFoundResult;

type HorizonTransactionResponse = {
	hash?: unknown;
	ledger?: unknown;
	successful?: unknown;
	currentLedger?: unknown;
	latest_ledger?: unknown;
};

function asFiniteNumber(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return value;
}

function toPositiveInt(value: number, fallback: number): number {
	if (!Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.floor(value);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

export async function fetchTransactionOnce(txHash: string): Promise<FetchTransactionResult> {
	const horizonUrl = process.env.HORIZON_URL ?? TESTNET_HORIZON_URL;
	const fetchFn = (globalThis as { fetch?: (input: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> }).fetch;

	if (!fetchFn) {
		throw new Error('Global fetch is not available in this runtime.');
	}

	const response = await fetchFn(`${horizonUrl}/transactions/${txHash}`);

	if (response.status === 404) {
		return { status: 'not_found' };
	}

	if (!response.ok) {
		throw new Error(`Failed to fetch transaction ${txHash}: HTTP ${response.status}`);
	}

	const payload = (await response.json()) as HorizonTransactionResponse;
	const successful = payload.successful === true;
	const txLedger = asFiniteNumber(payload.ledger) ?? 0;
	const currentLedger =
		asFiniteNumber(payload.currentLedger) ??
		asFiniteNumber(payload.latest_ledger) ??
		txLedger;

	return {
		status: successful ? 'confirmed' : 'failed',
		hash: typeof payload.hash === 'string' ? payload.hash : txHash,
		txLedger,
		currentLedger,
		successful,
	};
}

export async function monitorTransaction(
	txHash: string,
	options: MonitorTransactionOptions = {},
): Promise<TransactionStatus> {
	const maxAttempts = toPositiveInt(options.maxAttempts ?? 30, 30);
	const intervalMs = toPositiveInt(options.intervalMs ?? 5000, 5000);
	let consecutiveNotFound = 0;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const result = await fetchTransactionOnce(txHash);

		if (result.status === 'not_found') {
			consecutiveNotFound += 1;

			if (attempt >= maxAttempts) {
				break;
			}

			const backoffMultiplier =
				consecutiveNotFound > 5 ? 2 ** (consecutiveNotFound - 5) : 1;
			await sleep(intervalMs * backoffMultiplier);
			continue;
		}

		const confirmations = Math.max(0, result.currentLedger - result.txLedger);
		return {
			confirmed: result.status === 'confirmed',
			confirmations,
			ledger: result.txLedger,
			hash: result.hash,
			successful: result.successful,
		};
	}

	throw new MonitorTimeoutError(txHash, maxAttempts);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }
