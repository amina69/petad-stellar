import { getMinimumReserve } from '../../../src/accounts/keypair';

describe('getMinimumReserve', () => {
  it('base account (0 subentries) = 1 XLM', () => {
    expect(getMinimumReserve(0, 0, 0)).toBe('1');
  });

  it('3-signer escrow (numSigners=3) = 2.5 XLM', () => {
    expect(getMinimumReserve(3, 0, 0)).toBe('2.5');
  });

  it('sums subentries (signers+offers+trustlines)', () => {
    // numSubentries = 1 + 2 + 3 = 6 => 0.5 * (2 + 6) = 4
    expect(getMinimumReserve(1, 2, 3)).toBe('4');
  });
});
