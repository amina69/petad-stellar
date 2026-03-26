import {
  createEscrowAccount,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';

describe('escrow module placeholders', () => {
  it('exports callable placeholder functions', () => {
    expect(createEscrowAccount()).toBeUndefined();
    expect(lockCustodyFunds()).toBeUndefined();
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});

