import axios from 'axios';
import {
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { getMinimumReserve } from '../accounts';
import { TESTNET_HORIZON_URL } from '../utils/constants';
import {
  HorizonSubmitError,
  InsufficientBalanceError,
  TransactionTimeoutError,
  ValidationError,
} from '../utils/errors';
import { isValidAmount, isValidPublicKey } from '../utils/validation';
import type { SubmitResult } from '../types/transaction';

export interface CreateAccountParams {
  destination: string;
  startingBalance: string;
}

const MINIMUM_RESERVE_XLM = getMinimumReserve(0, 0, 0);

export function buildCreateAccountOp({
  destination,
  startingBalance,
}: CreateAccountParams): ReturnType<typeof Operation.createAccount> {
  if (!isValidPublicKey(destination)) {
    throw new ValidationError('destination', 'Invalid destination public key');
  }

  if (!isValidAmount(startingBalance)) {
    throw new ValidationError('startingBalance', 'Invalid starting balance');
  }

  if (Number(startingBalance) < Number(MINIMUM_RESERVE_XLM)) {
    throw new ValidationError(
      'startingBalance',
      `Starting balance must be at least ${MINIMUM_RESERVE_XLM} XLM to satisfy the minimum reserve`,
    );
  }

  return Operation.createAccount({
    destination,
    startingBalance,
  });
}

export function transactionToXDR(tx: Transaction): string {
  return tx.toXDR();
}

export function transactionFromXDR(xdr: string): Transaction {
  if (typeof xdr !== 'string' || xdr.trim().length === 0) {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }

  try {
    return TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  } catch {
    throw new ValidationError('xdr', 'Invalid XDR envelope');
  }
}

type HorizonResultCodes = {
  transaction?: string;
  operations?: string[];
};

type HorizonErrorResponse = {
  response?: {
    status?: number;
    data?: {
      extras?: {
        result_codes?: string | HorizonResultCodes;
      };
      hash?: string;
    };
  };
};

function mapSubmissionError(error: unknown, tx: Transaction): Error {
  const submissionError = error as HorizonErrorResponse;

  if (submissionError.response?.status === 504) {
    return new TransactionTimeoutError(tx.hash().toString('hex'));
  }

  const resultCodes = submissionError.response?.data?.extras?.result_codes;
  const transactionCode =
    typeof resultCodes === 'string' ? resultCodes : resultCodes?.transaction;
  const operationCodes =
    typeof resultCodes === 'object' && resultCodes !== null
      ? resultCodes.operations
      : undefined;
  const operationCode = operationCodes?.find(Boolean);

  if (operationCode === 'op_underfunded') {
    return new InsufficientBalanceError('unknown', 'unknown');
  }

  const rawCode = transactionCode ?? operationCode;

  if (rawCode) {
    return new HorizonSubmitError(rawCode);
  }

  return new HorizonSubmitError('unknown');
}

export async function submitTransaction(
  tx: Transaction,
  horizonUrl: string = TESTNET_HORIZON_URL,
): Promise<SubmitResult> {
  try {
    const response = await axios.post(
      `${horizonUrl}/transactions`,
      new URLSearchParams({ tx: tx.toXDR() }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return {
      successful: Boolean(response.data?.successful ?? true),
      hash: response.data.hash,
      ledger: response.data.ledger,
      resultXdr: response.data.result_xdr,
    };
  } catch (error) {
    throw mapSubmissionError(error, tx);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }
