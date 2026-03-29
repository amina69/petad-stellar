import {
  createEscrowAccount,
  calculateStartingBalance,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { ValidationError } from '../../../src/utils/errors';
import { CreateEscrowParams } from '../../../src/types/escrow';
import { InsufficientBalanceError } from '../../../src/utils/errors';

describe('calculateStartingBalance', () => {
  describe('happy path', () => {
    it('calculates starting balance with 10 XLM deposit', () => {
      expect(calculateStartingBalance('10')).toBe('12.5');
    });

    it('calculates starting balance with 100 XLM deposit', () => {
      expect(calculateStartingBalance('100')).toBe('102.5');
    });

    it('calculates starting balance with 0.5 XLM deposit', () => {
      expect(calculateStartingBalance('0.5')).toBe('3');
    });

    it('calculates starting balance with 1 XLM deposit', () => {
      expect(calculateStartingBalance('1')).toBe('3.5');
    });

    it('calculates starting balance with 0.0000001 XLM deposit (smallest unit)', () => {
      expect(calculateStartingBalance('0.0000001')).toBe('2.5000001');
    });

    it('calculates starting balance with 10000 XLM deposit', () => {
      expect(calculateStartingBalance('10000')).toBe('10002.5');
    });

    it('handles decimal amounts with 7 decimal precision', () => {
      expect(calculateStartingBalance('1.2345678')).toBe('3.7345678');
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError for invalid amount format', () => {
      expect(() => calculateStartingBalance('invalid')).toThrow(ValidationError);
      expect(() => calculateStartingBalance('invalid')).toThrow('Invalid deposit amount: invalid');
    });

    it('throws ValidationError for zero amount', () => {
      expect(() => calculateStartingBalance('0')).toThrow(ValidationError);
    });

    it('throws ValidationError for negative amount', () => {
      expect(() => calculateStartingBalance('-10')).toThrow(ValidationError);
    });

    it('throws ValidationError for empty string', () => {
      expect(() => calculateStartingBalance('')).toThrow(ValidationError);
    });

    it('throws ValidationError for more than 7 decimal places', () => {
      expect(() => calculateStartingBalance('10.12345678')).toThrow(ValidationError);
    });
  });
});

describe('createEscrowAccount', () => {
  const mockAccountManager = {
    create: jest.fn(),
    getBalance: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validParams: CreateEscrowParams = {
    adopterPublicKey: 'GAGVLQRZZTHIXM7FYEXYA3Q2HNYOZ3FLQORBQIISF6YJQIHE5UIE2JMX',
    ownerPublicKey: 'GAPEGAX7B6NBY6NOCLTM7QOQIZWD72KLZRWSYSOT25MFNY5ADK7KR7EE',
    depositAmount: '10',
  };

  describe('happy path', () => {
    it('creates an escrow account with correct starting balance', async () => {
      mockAccountManager.create.mockResolvedValue({
        accountId: 'GXXX123456789',
        transactionHash: 'abc123def456',
      });

      const result = await createEscrowAccount(validParams, mockAccountManager);

      expect(mockAccountManager.create).toHaveBeenCalledWith({
        publicKey: expect.any(String),
        startingBalance: '12.5',
      });

      expect(result.accountId).toBe('GXXX123456789');
      expect(result.transactionHash).toBe('abc123def456');
      expect(result.signers).toHaveLength(3);
      expect(result.thresholds).toEqual({
        low: 1,
        medium: 2,
        high: 2,
      });
    });

    it('includes unlockDate when provided', async () => {
      const unlockDate = new Date('2024-12-31');
      mockAccountManager.create.mockResolvedValue({
        accountId: 'GXXX123456789',
        transactionHash: 'abc123def456',
      });

      const result = await createEscrowAccount({ ...validParams, unlockDate }, mockAccountManager);

      expect(result.unlockDate).toEqual(unlockDate);
    });

    it('handles different deposit amounts correctly', async () => {
      mockAccountManager.create.mockResolvedValue({
        accountId: 'GXXX123456789',
        transactionHash: 'abc123def456',
      });

      await createEscrowAccount({ ...validParams, depositAmount: '50' }, mockAccountManager);

      expect(mockAccountManager.create).toHaveBeenCalledWith({
        publicKey: expect.any(String),
        startingBalance: '52.5',
      });
    });
  });

  describe('validation errors', () => {
    it('throws ValidationError for invalid adopter public key', async () => {
      await expect(
        createEscrowAccount({ ...validParams, adopterPublicKey: 'INVALID' }, mockAccountManager),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid owner public key', async () => {
      await expect(
        createEscrowAccount({ ...validParams, ownerPublicKey: 'INVALID' }, mockAccountManager),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid deposit amount', async () => {
      await expect(
        createEscrowAccount({ ...validParams, depositAmount: '-10' }, mockAccountManager),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('InsufficientBalanceError handling', () => {
    it('re-throws InsufficientBalanceError from account manager', async () => {
      const error = new InsufficientBalanceError('100', '50');
      mockAccountManager.create.mockRejectedValue(error);

      await expect(createEscrowAccount(validParams, mockAccountManager)).rejects.toThrow(
        InsufficientBalanceError,
      );
    });

    it('error message contains required and available amounts', async () => {
      const error = new InsufficientBalanceError('100', '50');
      mockAccountManager.create.mockRejectedValue(error);

      await expect(createEscrowAccount(validParams, mockAccountManager)).rejects.toThrow(
        'Insufficient balance. Required: 100, available: 50',
      );
    });
  });

  describe('other errors', () => {
    it('re-throws generic errors from account manager', async () => {
      const error = new Error('Network error');
      mockAccountManager.create.mockRejectedValue(error);

      await expect(createEscrowAccount(validParams, mockAccountManager)).rejects.toThrow(
        'Network error',
      );
    });
  });
});

describe('placeholder functions', () => {
  it('anchorTrustHash and verifyEventHash are callable stubs', () => {
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});
