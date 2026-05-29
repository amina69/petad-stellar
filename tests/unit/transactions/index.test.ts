import { Keypair, Operation } from '@stellar/stellar-sdk';

import {
  buildCreateAccountOp,
  buildMultisigTransaction,
} from '../../../src/transactions';

const VALID_DESTINATION = Keypair.random().publicKey();

describe('transactions module', () => {
  it('keeps multisig placeholder callable', () => {
    expect(buildMultisigTransaction()).toBeUndefined();
  });

  it('builds a valid create-account operation', () => {
    const operation = buildCreateAccountOp({
      destination: VALID_DESTINATION,
      startingBalance: '1.5',
    });

    expect(operation).toEqual(
      Operation.createAccount({
        destination: VALID_DESTINATION,
        startingBalance: '1.5',
      }),
    );
  });

  it('rejects a starting balance below the minimum reserve', () => {
    expect(() => buildCreateAccountOp({
      destination: VALID_DESTINATION,
      startingBalance: '0.5',
    })).toThrow('minimum reserve');
  });
});
