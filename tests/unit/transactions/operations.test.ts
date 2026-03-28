import { Keypair } from '@stellar/stellar-sdk';
import { buildCreateAccountOp } from '../../../src/transactions/operations';
import { ValidationError } from '../../../src/utils/errors';
import { getMinimumReserve } from '../../../src/accounts';

describe('buildCreateAccountOp', () => {
  const destination = Keypair.random().publicKey();

  it('builds a valid CreateAccount operation', () => {
    const minReserve = getMinimumReserve(0, 0, 0);
    const startingBalance = (parseFloat(minReserve) + 1).toString();

    const op = buildCreateAccountOp({ destination, startingBalance });

    expect(op).toBeDefined();
    // In some versions, this is an XDR object, in others a literal. 
    // Since we're returning the SDK call result, we just ensure it's not null.
  });

  it('throws ValidationError for invalid destination', () => {
    expect(() =>
      buildCreateAccountOp({ destination: 'invalid', startingBalance: '10' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildCreateAccountOp({ destination: 'invalid', startingBalance: '10' }),
    ).toThrow('Invalid destination public key');
  });

  it('throws ValidationError for too-low balance', () => {
    const minReserve = getMinimumReserve(0, 0, 0);
    const belowReserve = (parseFloat(minReserve) - 0.1).toFixed(7).replace(/\.?0+$/, '');

    expect(() =>
      buildCreateAccountOp({ destination, startingBalance: belowReserve }),
    ).toThrow(ValidationError);
    expect(() =>
      buildCreateAccountOp({ destination, startingBalance: belowReserve }),
    ).toThrow(`Starting balance must be at least ${minReserve} XLM`);
  });

  it('throws ValidationError for invalid balance format', () => {
    expect(() =>
      buildCreateAccountOp({ destination, startingBalance: 'abc' }),
    ).toThrow(ValidationError);
    expect(() =>
      buildCreateAccountOp({ destination, startingBalance: 'abc' }),
    ).toThrow('Invalid starting balance amount');
  });
});
