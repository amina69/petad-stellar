import { Operation } from '@stellar/stellar-sdk';

import { getMinimumReserve } from '../accounts';
import { ValidationError } from '../utils/errors';
import { isValidAmount, isValidPublicKey } from '../utils/validation';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }
