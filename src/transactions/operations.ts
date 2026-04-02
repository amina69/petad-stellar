import { Operation, xdr } from '@stellar/stellar-sdk';
import { ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { getMinimumReserve } from '../accounts/index';

/**
 * Build a CreateAccount operation for funding new Stellar accounts.
 * @param params {destination, startingBalance}
 * @returns {xdr.Operation}
 */
export function buildCreateAccountOp(params: {
  destination: string;
  startingBalance: string;
}): xdr.Operation {
  const { destination, startingBalance } = params;

  if (!isValidPublicKey(destination)) {
    throw new ValidationError('destination', 'Invalid destination public key');
  }

  if (!isValidAmount(startingBalance)) {
    throw new ValidationError('startingBalance', 'Invalid starting balance');
  }

  // Minimum reserve for a new account (0 subentries)
  const minReserve = getMinimumReserve(0, 0, 0);
  if (parseFloat(startingBalance) < parseFloat(minReserve)) {
    throw new ValidationError(
      'startingBalance',
      `Starting balance must be at least ${minReserve} XLM`
    );
  }

  return Operation.createAccount({
    destination,
    startingBalance,
  }) as xdr.Operation;
}
