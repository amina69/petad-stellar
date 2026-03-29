import { Asset, Operation } from '@stellar/stellar-sdk';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { ValidationError } from '../utils/errors';

export { decodeMemo, type DecodedMemo } from './builder';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMultisigTransaction(..._args: unknown[]): unknown { return undefined; }

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
  return Operation.payment({ destination, asset, amount });
}
