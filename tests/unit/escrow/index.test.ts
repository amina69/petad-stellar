import {
  anchorTrustHash,
  createEscrowAccount,
  lockCustodyFunds,
  verifyEventHash,
} from '../../../src/escrow';

describe('escrow module', () => {
  describe('createEscrowAccount', () => {
    it('returns valid G.../S... pair', () => {
      const result = createEscrowAccount();

      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('secretKey');

      // Stellar public keys start with 'G'
      expect(result.publicKey).toMatch(/^G[A-Z0-9]{55}$/);

      // Stellar secret keys start with 'S'
      expect(result.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('generates unique keypairs', () => {
      const result1 = createEscrowAccount();
      const result2 = createEscrowAccount();

      expect(result1.publicKey).not.toBe(result2.publicKey);
      expect(result1.secretKey).not.toBe(result2.secretKey);
    });
  });

  describe('placeholder functions', () => {
    it('exports callable placeholder functions', () => {
      expect(lockCustodyFunds()).toBeUndefined();
      expect(anchorTrustHash()).toBeUndefined();
      expect(verifyEventHash()).toBeUndefined();
    });
  });
});
