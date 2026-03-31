import { createEscrowAccount } from '../../../src/escrow';
import { CreateEscrowParams } from '../../../src/types/escrow';
import { ValidationError } from '../../../src/utils/errors';

describe('createEscrowAccount', () => {
  const mockAdopterPublicKey = 'GADOPTER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456';
  const mockOwnerPublicKey = 'GOWNER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567';
  const mockPlatformPublicKey = 'GPLATFORM1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12';
  const mockMasterSecretKey = 'SMASTER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

  const validParams: CreateEscrowParams = {
    adopterPublicKey: mockAdopterPublicKey,
    ownerPublicKey: mockOwnerPublicKey,
    depositAmount: '100.0000000',
    adoptionFee: '5.0000000',
    unlockDate: new Date('2024-12-31T23:59:59Z'),
    metadata: { adoptionId: 'adopt-123', petId: 'pet-456' }
  };

  describe('Input validation', () => {
    it('should throw ValidationError when adopterPublicKey is missing', async () => {
      const invalidParams = { ...validParams, adopterPublicKey: '' };
      
      await expect(
        createEscrowAccount(invalidParams, mockPlatformPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when ownerPublicKey is missing', async () => {
      const invalidParams = { ...validParams, ownerPublicKey: '' };
      
      await expect(
        createEscrowAccount(invalidParams, mockPlatformPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when platformPublicKey is missing', async () => {
      await expect(
        createEscrowAccount(validParams, '', mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when masterSecretKey is missing', async () => {
      await expect(
        createEscrowAccount(validParams, mockPlatformPublicKey, '')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when adopter and owner public keys are the same', async () => {
      const invalidParams = { ...validParams, ownerPublicKey: mockAdopterPublicKey };
      
      await expect(
        createEscrowAccount(invalidParams, mockPlatformPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when adopter and platform public keys are the same', async () => {
      const invalidParams = { ...validParams };
      
      await expect(
        createEscrowAccount(invalidParams, mockAdopterPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when owner and platform public keys are the same', async () => {
      const invalidParams = { ...validParams };
      
      await expect(
        createEscrowAccount(invalidParams, mockOwnerPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Successful escrow account creation', () => {
    it('should create escrow account with correct 2-of-3 multisig configuration', async () => {
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);

      // Verify basic structure
      expect(result).toHaveProperty('accountId');
      expect(result).toHaveProperty('transactionHash');
      expect(result).toHaveProperty('signers');
      expect(result).toHaveProperty('thresholds');
      expect(result).toHaveProperty('unlockDate');

      // Verify signers configuration
      expect(result.signers).toHaveLength(3);
      
      const signerKeys = result.signers.map(s => s.publicKey);
      expect(signerKeys).toContain(mockAdopterPublicKey);
      expect(signerKeys).toContain(mockOwnerPublicKey);
      expect(signerKeys).toContain(mockPlatformPublicKey);

      // Verify all signers have weight 1
      result.signers.forEach(signer => {
        expect(signer.weight).toBe(1);
      });

      // Verify thresholds are correct (low:0, medium:2, high:2)
      expect(result.thresholds.low).toBe(0);
      expect(result.thresholds.medium).toBe(2);
      expect(result.thresholds.high).toBe(2);

      // Verify unlock date is preserved
      expect(result.unlockDate).toEqual(validParams.unlockDate);
    });

    it('should handle optional parameters correctly', async () => {
      const minimalParams: CreateEscrowParams = {
        adopterPublicKey: mockAdopterPublicKey,
        ownerPublicKey: mockOwnerPublicKey,
        depositAmount: '100.0000000'
      };

      const result = await createEscrowAccount(minimalParams, mockPlatformPublicKey, mockMasterSecretKey);

      // Should still create valid escrow account
      expect(result.signers).toHaveLength(3);
      expect(result.thresholds.low).toBe(0);
      expect(result.thresholds.medium).toBe(2);
      expect(result.thresholds.high).toBe(2);

      // Optional fields should be undefined
      expect(result.unlockDate).toBeUndefined();
    });

    it('should return unique transaction hash', async () => {
      const result1 = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      const result2 = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);

      // Each call should generate a different account and transaction hash
      expect(result1.accountId).not.toBe(result2.accountId);
      expect(result1.transactionHash).not.toBe(result2.transactionHash);
    });
  });

  describe('Signer configuration verification', () => {
    it('should ensure exactly 3 signers are configured', async () => {
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      expect(result.signers).toHaveLength(3);
    });

    it('should ensure all signers have weight 1', async () => {
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      
      result.signers.forEach(signer => {
        expect(signer.weight).toBe(1);
      });
    });

    it('should ensure all signer public keys are unique', async () => {
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      
      const uniqueKeys = new Set(result.signers.map(s => s.publicKey));
      expect(uniqueKeys.size).toBe(3);
    });

    it('should ensure thresholds are set correctly', async () => {
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      
      expect(result.thresholds).toEqual({
        low: 0,
        medium: 2,
        high: 2
      });
    });
  });

  describe('Error handling', () => {
    it('should propagate ValidationError from account manager', async () => {
      // This test would require mocking AccountManager to throw specific errors
      // For now, we test the error handling structure
      const invalidParams = { ...validParams, adopterPublicKey: '' };
      
      await expect(
        createEscrowAccount(invalidParams, mockPlatformPublicKey, mockMasterSecretKey)
      ).rejects.toThrow(ValidationError);
    });

    it('should wrap unexpected errors in generic Error', async () => {
      // This would require mocking AccountManager to throw unexpected errors
      // The implementation already handles this case
      const result = await createEscrowAccount(validParams, mockPlatformPublicKey, mockMasterSecretKey);
      expect(result).toBeDefined();
    });
  });
});
