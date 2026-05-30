import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TimeoutInfinite,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import {
  buildCreateAccountOp,
  buildMultisigTransaction,
  transactionFromXDR,
  transactionToXDR,
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

  it('serialises and deserialises a transaction', () => {
    const source = new Account(Keypair.random().publicKey(), '1');
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.manageData({ name: 'note', value: 'hello' }))
      .setTimeout(TimeoutInfinite)
      .build();

    const xdr = transactionToXDR(tx);
    const roundTripped = transactionFromXDR(xdr);

    expect(roundTripped.toXDR()).toBe(xdr);
    expect(roundTripped.operations).toEqual(tx.operations);
    expect(roundTripped.source).toBe(tx.source);
  });

  it('rejects invalid XDR input', () => {
    expect(() => transactionFromXDR('')).toThrow('Invalid XDR envelope');
    expect(() => transactionFromXDR('not xdr')).toThrow('Invalid XDR envelope');
  });
});
