import { Asset, Operation } from '@stellar/stellar-sdk';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { ValidationError } from '../utils/errors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }

/**
 * buildPaymentOp
 *
 * Builds a single Stellar payment operation ready to be added to a transaction.
 *
 * @param destination - Valid Stellar public key of the recipient
 * @param amount      - Positive decimal string (max 7 decimal places)
 * @param asset       - Stellar Asset object. Defaults to native XLM if omitted.
 * @returns           - Stellar SDK Payment operation object
 * @throws ValidationError if destination or amount is invalid
 *
 * @example
 * const op = buildPaymentOp({
 *   destination: 'GABC...XYZ',
 *   amount: '10.5',
 * });
 */
export function buildPaymentOp({
  destination,
  amount,
  asset = Asset.native(),
}: {
  destination: string;
  amount: string;
  asset?: Asset;
}): ReturnType<typeof Operation.payment> {
  if (!isValidPublicKey(destination)) {
    throw new ValidationError('destination', `Invalid Stellar public key: ${destination}`);
  }

  if (!isValidAmount(amount)) {
    throw new ValidationError('amount', `Invalid amount: ${amount}. Must be a positive decimal string with up to 7 decimal places.`);
  }

  return Operation.payment({
    destination,
    asset,
    amount,
  });
}