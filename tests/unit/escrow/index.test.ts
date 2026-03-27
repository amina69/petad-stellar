import { anchorTrustHash, lockCustodyFunds, verifyEventHash } from '../../../src/escrow';

describe('escrow module placeholders', () => {
  it('exports callable placeholder functions', () => {
    expect(lockCustodyFunds()).toBeUndefined();
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});
