import { AccountManager } from '../../../src/accounts/manager';
import type { Signer, Thresholds } from '../../../src/types/network';
import { ValidationError } from '../../../src/utils/errors';

describe('AccountManager', () => {
  let accountManager: AccountManager;

  beforeEach(() => {
    accountManager = new AccountManager();
  });

  describe('configureMultisig', () => {
    const mockAccountId = 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567';
    const mockMasterSecretKey = 'SMASTER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

    const validSigners = [
      { publicKey: 'GADOPTER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123', weight: 1 },
      { publicKey: 'GOWNER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345', weight: 1 },
      { publicKey: 'GPLATFORM1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12', weight: 1 },
    ];

    const validThresholds = { low: 0, medium: 2, high: 2 };

    it('should throw ValidationError when accountId is missing', async () => {
      await expect(
        accountManager.configureMultisig('', validSigners, validThresholds, mockMasterSecretKey),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when signers is missing', async () => {
      await expect(
        accountManager.configureMultisig(
          mockAccountId,
          undefined as unknown as Signer[],
          validThresholds,
          mockMasterSecretKey,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when thresholds is missing', async () => {
      await expect(
        accountManager.configureMultisig(
          mockAccountId,
          validSigners,
          undefined as unknown as Thresholds,
          mockMasterSecretKey,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when masterSecretKey is missing', async () => {
      await expect(
        accountManager.configureMultisig(mockAccountId, validSigners, validThresholds, ''),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when less than 2 signers provided', async () => {
      const singleSigner = [validSigners[0]];

      await expect(
        accountManager.configureMultisig(
          mockAccountId,
          singleSigner,
          validThresholds,
          mockMasterSecretKey,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when thresholds are negative', async () => {
      const invalidThresholds = { low: -1, medium: 2, high: 2 };

      await expect(
        accountManager.configureMultisig(
          mockAccountId,
          validSigners,
          invalidThresholds,
          mockMasterSecretKey,
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('should return account info with filtered signers (removing master key)', async () => {
      const result = await accountManager.configureMultisig(
        mockAccountId,
        validSigners,
        validThresholds,
        mockMasterSecretKey,
      );

      expect(result.accountId).toBe(mockAccountId);
      expect(result.signers).toEqual(validSigners);
      expect(result.thresholds).toEqual(validThresholds);
      expect(result.exists).toBe(true);
      expect(result.balance).toBe('10.0000000');
      expect(result.sequenceNumber).toBe('123456789');
    });

    it('should handle signers that include the account ID (master key)', async () => {
      const signersWithMaster = [
        ...validSigners,
        { publicKey: mockAccountId, weight: 1 }, // Master key included
      ];

      const result = await accountManager.configureMultisig(
        mockAccountId,
        signersWithMaster,
        validThresholds,
        mockMasterSecretKey,
      );

      // Master key should be filtered out
      expect(result.signers).toEqual(validSigners);
      expect(result.signers).not.toContainEqual({ publicKey: mockAccountId, weight: 1 });
    });
  });

  describe('createAccount', () => {
    it('should return a new keypair', async () => {
      const result = await accountManager.createAccount('SMASTER123', '2.0000000');

      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('secretKey');
      expect(result.publicKey).toMatch(/^GD/); // Stellar public keys start with GD
      expect(result.secretKey).toMatch(/^S/); // Stellar secret keys start with S
      expect(result.publicKey).toHaveLength(56); // Stellar public keys are 56 characters
    });
  });

  describe('getAccount', () => {
    it('should return account info for non-existent account', async () => {
      const accountId = 'GNONEXISTENT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1';

      const result = await accountManager.getAccount(accountId);

      expect(result.accountId).toBe(accountId);
      expect(result.exists).toBe(false);
      expect(result.balance).toBe('0.0000000');
      expect(result.signers).toEqual([]);
      expect(result.thresholds).toEqual({ low: 0, medium: 0, high: 0 });
      expect(result.sequenceNumber).toBe('0');
    });
  });
});
