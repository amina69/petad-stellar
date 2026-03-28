import { Operation } from '@stellar/stellar-sdk';
import { getMinimumReserve } from '../accounts';
import { ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';

/**
 * Build a CreateAccount operation for funding new Stellar accounts.
 * @param destination The account ID to fund.
 * @param startingBalance The initial XLM balance.
 * @returns A Stellar SDK CreateAccount operation.
 * @throws ValidationError if inputs are invalid or balance is too low.
 */
export function buildCreateAccountOp(params: {
  destination: string;
  startingBalance: string;
}): any {
  const { destination, startingBalance } = params;

  if (!isValidPublicKey(destination)) {
    throw new ValidationError('destination', 'Invalid destination public key');
  }

  if (!isValidAmount(startingBalance)) {
    throw new ValidationError('startingBalance', 'Invalid starting balance amount');
  }

  const minReserve = getMinimumReserve(0, 0, 0);
  if (parseFloat(startingBalance) < parseFloat(minReserve)) {
    throw new ValidationError(
      'startingBalance',
      `Starting balance must be at least ${minReserve} XLM`,
    );
  }

  return Operation.createAccount({
    destination,
    startingBalance,
  });
}
