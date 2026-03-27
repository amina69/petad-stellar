import {
  createEscrowAccount,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
  releaseFunds,
} from '../../../src/escrow';
import { asPercentage } from '../../../src/types/escrow';

const RECIPIENT_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const RECIPIENT_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB7H';
const RECIPIENT_C = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCD';

describe('escrow module placeholders', () => {
  it('exports callable placeholder functions', () => {
    expect(createEscrowAccount()).toBeUndefined();
    expect(lockCustodyFunds()).toBeUndefined();
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});

describe('releaseFunds', () => {
  it('builds exact payment operations for a 60/40 split from 500 XLM', () => {
    const operations = releaseFunds('500.0000000', [
      { recipient: RECIPIENT_A, percentage: asPercentage(60) },
      { recipient: RECIPIENT_B, percentage: asPercentage(40) },
    ]);

    expect(operations).toEqual([
      {
        type: 'Payment',
        destination: RECIPIENT_A,
        asset: 'XLM',
        amount: '300.0000000',
      },
      {
        type: 'Payment',
        destination: RECIPIENT_B,
        asset: 'XLM',
        amount: '200.0000000',
      },
    ]);
  });

  it('builds a single payment when one recipient receives 100%', () => {
    const operations = releaseFunds('500.0000000', [
      { recipient: RECIPIENT_A, percentage: asPercentage(100) },
    ]);

    expect(operations).toEqual([
      {
        type: 'Payment',
        destination: RECIPIENT_A,
        asset: 'XLM',
        amount: '500.0000000',
      },
    ]);
  });

  it('keeps a three-way split summed exactly to the original balance', () => {
    const operations = releaseFunds('1.0000000', [
      { recipient: RECIPIENT_A, percentage: asPercentage(33.3333333) },
      { recipient: RECIPIENT_B, percentage: asPercentage(33.3333333) },
      { recipient: RECIPIENT_C, percentage: asPercentage(33.3333334) },
    ]);

    expect(operations).toEqual([
      {
        type: 'Payment',
        destination: RECIPIENT_A,
        asset: 'XLM',
        amount: '0.3333333',
      },
      {
        type: 'Payment',
        destination: RECIPIENT_B,
        asset: 'XLM',
        amount: '0.3333333',
      },
      {
        type: 'Payment',
        destination: RECIPIENT_C,
        asset: 'XLM',
        amount: '0.3333334',
      },
    ]);

    const total = operations.reduce((sum, operation) => {
      return sum + Number(operation.amount);
    }, 0);

    expect(total.toFixed(7)).toBe('1.0000000');
  });
});

