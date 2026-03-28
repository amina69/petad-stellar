import { Asset, Operation } from '@stellar/stellar-sdk';
import { buildPaymentOp } from '../../../src/transactions';
import { ValidationError } from '../../../src/utils/errors';


const VALID_DESTINATION = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const VALID_AMOUNT = '10.5';

describe('buildPaymentOp', () => {
  it('returns a valid payment operation with native XLM by default', () => {
    const op = buildPaymentOp({
      destination: VALID_DESTINATION,
      amount: VALID_AMOUNT,
    });

    const decoded = Operation.fromXDRObject(op);

    expect(decoded).toBeDefined();
    expect(decoded.type).toBe('payment');
    expect((decoded as Operation.Payment).destination).toBe(VALID_DESTINATION);
    expect((decoded as Operation.Payment).amount).toBe('10.5000000');
    expect((decoded as Operation.Payment).asset.isNative()).toBe(true);
  });

  it('returns a payment operation with a custom asset', () => {
    const usdc = new Asset(
      'USDC',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    );
    const op = buildPaymentOp({
      destination: VALID_DESTINATION,
      amount: VALID_AMOUNT,
      asset: usdc,
    });

    const decoded = Operation.fromXDRObject(op) as Operation.Payment;
    expect(decoded.asset.code).toBe('USDC');
    expect(decoded.asset.isNative()).toBe(false);
  });

  it('throws ValidationError for invalid destination', () => {
    expect(() =>
      buildPaymentOp({ destination: 'INVALID_KEY', amount: VALID_AMOUNT }),
    ).toThrow(ValidationError);

    expect(() =>
      buildPaymentOp({ destination: 'INVALID_KEY', amount: VALID_AMOUNT }),
    ).toThrow(/Invalid Stellar public key/);
  });

  it('throws ValidationError for empty destination', () => {
    expect(() =>
      buildPaymentOp({ destination: '', amount: VALID_AMOUNT }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for zero amount', () => {
    expect(() =>
      buildPaymentOp({ destination: VALID_DESTINATION, amount: '0' }),
    ).toThrow(ValidationError);

    expect(() =>
      buildPaymentOp({ destination: VALID_DESTINATION, amount: '0' }),
    ).toThrow(/Invalid amount/);
  });

  it('throws ValidationError for negative amount', () => {
    expect(() =>
      buildPaymentOp({ destination: VALID_DESTINATION, amount: '-5' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for non-numeric amount', () => {
    expect(() =>
      buildPaymentOp({ destination: VALID_DESTINATION, amount: 'abc' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError for empty amount', () => {
    expect(() =>
      buildPaymentOp({ destination: VALID_DESTINATION, amount: '' }),
    ).toThrow(ValidationError);
  });

  it('is exported from the public index', async () => {
    const mod = await import('../../../src/index');
    expect(mod.buildPaymentOp).toBeDefined();
  });
});
