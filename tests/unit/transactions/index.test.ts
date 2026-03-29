import { buildMultisigTransaction } from '../../../src/transactions';
import { ValidationError } from '../../../src/utils/errors';
import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

function buildUnsignedTransaction(): Transaction {
  const source = Keypair.random();
  const account = new Account(source.publicKey(), '1');

  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(30)
    .build();
}

describe('buildMultisigTransaction', () => {
  it('signs transaction with a single secret key', () => {
    const signer = Keypair.random();
    const transaction = buildUnsignedTransaction();

    const signed = buildMultisigTransaction(transaction, [signer.secret()]);

    expect(signed).toBe(transaction);
    expect(signed.signatures).toHaveLength(1);
  });

  it('signs transaction with multiple secret keys', () => {
    const signerA = Keypair.random();
    const signerB = Keypair.random();
    const transaction = buildUnsignedTransaction();

    const signed = buildMultisigTransaction(transaction, [signerA.secret(), signerB.secret()]);

    expect(signed).toBe(transaction);
    expect(signed.signatures).toHaveLength(2);
  });

  it('throws ValidationError when any secret key is invalid', () => {
    const signer = Keypair.random();
    const transaction = buildUnsignedTransaction();

    expect(() => {
      buildMultisigTransaction(transaction, [signer.secret(), 'SINVALID']);
    }).toThrow(ValidationError);
    expect(transaction.signatures).toHaveLength(0);
  });

  it('throws ValidationError when secret keys array is empty', () => {
    const transaction = buildUnsignedTransaction();

    expect(() => {
      buildMultisigTransaction(transaction, []);
    }).toThrow(ValidationError);
    expect(transaction.signatures).toHaveLength(0);
  });
});

