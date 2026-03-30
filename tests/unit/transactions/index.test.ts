import { buildMultisigTransaction } from '../../../src/transactions';

describe('transactions module placeholders', () => {
  it('exports callable placeholder function', () => {
    expect(buildMultisigTransaction()).toBeUndefined();
  });
});

