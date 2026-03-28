import { TransactionBuilder, Account, Keypair, Memo } from '@stellar/stellar-sdk';
import { StellarSDK } from '../../../src/sdk';
import { ValidationError } from '../../../src/utils/errors';

describe('Transaction XDR round-trip', () => {
  const sdk = new StellarSDK({
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    masterSecretKey: Keypair.random().secret(),
  });

  const account = new Account(Keypair.random().publicKey(), '1');
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: sdk.networkPassphrase,
  })
    .addMemo(Memo.text('test'))
    .setTimeout(0)
    .build();

  it('round-trip serialize -> deserialize -> equal', () => {
    const xdr = sdk.transactionToXDR(tx);
    const deserialized = sdk.transactionFromXDR(xdr);

    expect(deserialized.toXDR()).toBe(tx.toXDR());
    expect(deserialized.fee).toBe(tx.fee);
    expect(deserialized.sequence).toBe(tx.sequence);
  });

  it('throws ValidationError for empty XDR', () => {
    expect(() => sdk.transactionFromXDR('')).toThrow(ValidationError);
    expect(() => sdk.transactionFromXDR('')).toThrow('Invalid XDR envelope');
  });

  it('throws ValidationError for invalid XDR', () => {
    expect(() => sdk.transactionFromXDR('invalid-xdr')).toThrow(ValidationError);
    expect(() => sdk.transactionFromXDR('invalid-xdr')).toThrow('Invalid XDR envelope');
  });
});
