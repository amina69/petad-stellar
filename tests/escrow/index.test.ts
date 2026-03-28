import {
  createEscrowAccount,
  clearEscrowCache,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { CreateEscrowParams } from '../../../src/types/escrow';
import { ValidationError, SdkError, FriendbotError } from '../../../src/utils/errors';
import { Keypair, Horizon, TransactionBuilder, Operation } from '@stellar/stellar-sdk';

// Mock the @stellar/stellar-sdk
jest.mock('@stellar/stellar-sdk', () => {
  const mockKeypair = {
    publicKey: jest.fn().mockReturnValue('GBMOCKEDESCROWPUBLICKEY12345678901234567890123456'),
    secret: jest.fn().mockReturnValue('SBMOCKEDSECRETKEY123456789012345678901234567890123'),
  };

  const mockTransaction = {
    sign: jest.fn(),
  };

  const mockTransactionBuilder = {
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue(mockTransaction),
  };

  const mockAccount = {
    accountId: jest.fn().mockReturnValue('GBMOCKEDESCROWPUBLICKEY12345678901234567890123456'),
  };

  const mockServer = {
    loadAccount: jest.fn().mockResolvedValue(mockAccount),
    submitTransaction: jest.fn().mockResolvedValue({
      hash: 'mockedtransactionhash1234567890abcdef1234567890abcdef12345678',
    }),
  };

  return {
    Keypair: {
      random: jest.fn().mockReturnValue(mockKeypair),
    },
    Horizon: {
      Server: jest.fn().mockImplementation(() => mockServer),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => mockTransactionBuilder),
    Operation: {
      setOptions: jest.fn().mockReturnValue({}),
    },
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
    },
    Memo: {
      none: jest.fn().mockReturnValue({ type: 'none' }),
      text: jest.fn().mockImplementation((text: string) => ({ type: 'text', value: text })),
    },
  };
});

// Mock global fetch for Friendbot
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('escrow module', () => {
  // Valid test data - public keys must be 56 characters starting with 'G'
  const validAdopterPublicKey = 'GADOPTERPUBLICKEY123456789012345678901234567890123456789';
  const validOwnerPublicKey = 'GOWNERPUBLICKEYAB123456789012345678901234567890123456789';
  const validDepositAmount = '100.0000000';

  const validParams: CreateEscrowParams = {
    adopterPublicKey: validAdopterPublicKey,
    ownerPublicKey: validOwnerPublicKey,
    depositAmount: validDepositAmount,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearEscrowCache();

    // Default successful Friendbot response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
  });

  describe('createEscrowAccount', () => {
    describe('validation', () => {
      it('throws ValidationError for invalid adopterPublicKey', async () => {
        const invalidParams = { ...validParams, adopterPublicKey: 'INVALID' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
        await expect(createEscrowAccount(invalidParams)).rejects.toMatchObject({
          field: 'adopterPublicKey',
          code: 'VALIDATION_ERROR',
        });
      });

      it('throws ValidationError for adopterPublicKey not starting with G', async () => {
        const invalidParams = {
          ...validParams,
          adopterPublicKey: 'SADOPTERPUBLICKEY1234567890123456789012345678901234'
        };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for adopterPublicKey with wrong length', async () => {
        const invalidParams = {
          ...validParams,
          adopterPublicKey: 'GSHORT'
        };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for invalid ownerPublicKey', async () => {
        const invalidParams = { ...validParams, ownerPublicKey: 'INVALID' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
        await expect(createEscrowAccount(invalidParams)).rejects.toMatchObject({
          field: 'ownerPublicKey',
          code: 'VALIDATION_ERROR',
        });
      });

      it('throws ValidationError for ownerPublicKey not starting with G', async () => {
        const invalidParams = {
          ...validParams,
          ownerPublicKey: 'SOWNERPUBLICKEYAB12345678901234567890123456789012345'
        };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for invalid depositAmount (negative)', async () => {
        const invalidParams = { ...validParams, depositAmount: '-100' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
        await expect(createEscrowAccount(invalidParams)).rejects.toMatchObject({
          field: 'depositAmount',
          code: 'VALIDATION_ERROR',
        });
      });

      it('throws ValidationError for invalid depositAmount (non-numeric)', async () => {
        const invalidParams = { ...validParams, depositAmount: 'abc' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for invalid depositAmount (too many decimals)', async () => {
        const invalidParams = { ...validParams, depositAmount: '100.12345678' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });

      it('throws ValidationError for zero depositAmount', async () => {
        const invalidParams = { ...validParams, depositAmount: '0' };

        await expect(createEscrowAccount(invalidParams)).rejects.toThrow(ValidationError);
      });
    });

    describe('idempotency', () => {
      it('returns cached escrow account for duplicate requests', async () => {
        const result1 = await createEscrowAccount(validParams);
        const result2 = await createEscrowAccount(validParams);

        expect(result1).toEqual(result2);
        // Keypair.random should only be called once
        expect(Keypair.random).toHaveBeenCalledTimes(1);
      });

      it('creates new escrow for different parameters', async () => {
        const params1 = { ...validParams };
        const params2 = { ...validParams, depositAmount: '200.0000000' };

        await createEscrowAccount(params1);
        await createEscrowAccount(params2);

        // Keypair.random should be called twice
        expect(Keypair.random).toHaveBeenCalledTimes(2);
      });
    });

    describe('happy path - full lifecycle', () => {
      it('creates escrow account with all steps executed', async () => {
        const result = await createEscrowAccount(validParams);

        // Verify keypair generation
        expect(Keypair.random).toHaveBeenCalled();

        // Verify Friendbot funding
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('friendbot.stellar.org')
        );

        // Verify Horizon server creation
        expect(Horizon.Server).toHaveBeenCalled();

        // Verify transaction building
        expect(TransactionBuilder).toHaveBeenCalled();
        expect(Operation.setOptions).toHaveBeenCalled();

        // Verify result structure
        expect(result).toHaveProperty('accountId');
        expect(result).toHaveProperty('transactionHash');
        expect(result).toHaveProperty('signers');
        expect(result).toHaveProperty('thresholds');

        // Verify signers array
        expect(result.signers).toHaveLength(3);
        expect(result.signers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ weight: 1 }),
          ])
        );

        // Verify thresholds
        expect(result.thresholds).toEqual({
          low: 1,
          medium: 2,
          high: 2,
        });
      });

      it('includes unlockDate when provided', async () => {
        const unlockDate = new Date('2025-12-31');
        const paramsWithUnlock = { ...validParams, unlockDate };

        const result = await createEscrowAccount(paramsWithUnlock);

        expect(result.unlockDate).toEqual(unlockDate);
      });

      it('handles metadata encoding', async () => {
        const paramsWithMetadata: CreateEscrowParams = {
          ...validParams,
          metadata: {
            adoptionId: 'adopt-12345',
            petId: 'pet-67890',
          },
        };

        const result = await createEscrowAccount(paramsWithMetadata);

        expect(result).toHaveProperty('accountId');
        expect(result).toHaveProperty('transactionHash');
      });
    });

    describe('error handling', () => {
      it('throws FriendbotError when funding fails', async () => {
        // Override the default mock for this test
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500,
        });

        await expect(createEscrowAccount(validParams)).rejects.toThrow(FriendbotError);

        const params300 = { ...validParams, depositAmount: '300.0000000' };
        await expect(createEscrowAccount(params300)).rejects.toMatchObject({
          code: 'FRIENDBOT_ERROR',
          retryable: true,
        });
      });

      it('throws FriendbotError with 400 status', async () => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue({
          ok: false,
          status: 400,
        });

        const newParams = { ...validParams, depositAmount: '400.0000000' };
        await expect(createEscrowAccount(newParams)).rejects.toThrow(FriendbotError);
      });

      it('wraps unknown errors in SdkError', async () => {
        mockFetch.mockReset();
        mockFetch.mockRejectedValue(new Error('Network error'));

        const newParams = { ...validParams, depositAmount: '500.0000000' };
        await expect(createEscrowAccount(newParams)).rejects.toThrow(SdkError);

        const params501 = { ...validParams, depositAmount: '501.0000000' };
        await expect(createEscrowAccount(params501)).rejects.toMatchObject({
          code: 'ESCROW_CREATION_ERROR',
        });
      });

      it('re-throws ValidationError as-is', async () => {
        const invalidParams = { ...validParams, adopterPublicKey: 'INVALID' };

        try {
          await createEscrowAccount(invalidParams);
          fail('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).field).toBe('adopterPublicKey');
        }
      });
    });

    describe('multisig configuration', () => {
      it('configures three signers with correct weights', async () => {
        const result = await createEscrowAccount(validParams);

        expect(result.signers).toHaveLength(3);
        result.signers.forEach(signer => {
          expect(signer.weight).toBe(1);
          expect(signer.publicKey).toBeDefined();
        });
      });

      it('sets correct threshold values', async () => {
        const result = await createEscrowAccount(validParams);

        expect(result.thresholds.low).toBe(1);
        expect(result.thresholds.medium).toBe(2);
        expect(result.thresholds.high).toBe(2);
      });
    });
  });

  describe('other escrow module placeholders', () => {
    it('exports callable placeholder functions', () => {
      expect(lockCustodyFunds()).toBeUndefined();
      expect(anchorTrustHash()).toBeUndefined();
      expect(verifyEventHash()).toBeUndefined();
    });
  });
});
