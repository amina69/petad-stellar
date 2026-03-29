import {
  createEscrowAccount,
  calculateStartingBalance,
  handleDispute,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { ValidationError } from '../../../src/utils/errors';
import { CreateEscrowParams } from '../../../src/types/escrow';
import { InsufficientBalanceError } from '../../../src/utils/errors';
import { Account, Keypair, Operation } from '@stellar/stellar-sdk';

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

describe('handleDispute', () => {
  const escrowAccountId = Keypair.random().publicKey();
  const platformKeypair = Keypair.random();
  const adopterPublicKey = Keypair.random().publicKey();
  const ownerPublicKey = Keypair.random().publicKey();

  const mockHorizonServer = {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('sets adopter and owner signer weights to zero and sets platform to weight 3', async () => {
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '101',
        signers: [
          { key: adopterPublicKey, weight: 1 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '102',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'dispute-hash' });

    const result = await handleDispute(
      {
        escrowAccountId,
        masterSecretKey: platformKeypair.secret(),
      },
      mockHorizonServer,
    );

    expect(result.accountId).toBe(escrowAccountId);
    expect(result.platformOnlyMode).toBe(true);
    expect(result.txHash).toBe('dispute-hash');
    expect(result.pausedAt).toBeInstanceOf(Date);

    expect(mockHorizonServer.loadAccount).toHaveBeenCalledTimes(2);
    expect(mockHorizonServer.loadAccount).toHaveBeenNthCalledWith(1, escrowAccountId);
    expect(mockHorizonServer.loadAccount).toHaveBeenNthCalledWith(2, escrowAccountId);

    expect(setOptionsSpy).toHaveBeenCalledWith({
      source: escrowAccountId,
      signer: {
        ed25519PublicKey: adopterPublicKey,
        weight: 0,
      },
    });

    expect(setOptionsSpy).toHaveBeenCalledWith({
      source: escrowAccountId,
      signer: {
        ed25519PublicKey: ownerPublicKey,
        weight: 0,
      },
    });

    expect(setOptionsSpy).toHaveBeenCalledWith({
      source: escrowAccountId,
      signer: {
        ed25519PublicKey: platformKeypair.publicKey(),
        weight: 3,
      },
    });

    expect(setOptionsSpy).toHaveBeenCalledWith({
      source: escrowAccountId,
      masterWeight: 0,
      lowThreshold: 0,
      medThreshold: 2,
      highThreshold: 2,
    });
  });

  it('throws ValidationError for invalid escrow account id', async () => {
    await expect(
      handleDispute(
        {
          escrowAccountId: 'invalid',
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for invalid master secret key', async () => {
    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: 'invalid',
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('throws ValidationError for checksum-invalid master secret key', async () => {
    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: `S${'A'.repeat(55)}`,
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('is idempotent when account is already in platform-only mode', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '201',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '202',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'idempotent-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      platformOnlyMode: true,
      txHash: 'idempotent-hash',
    });
  });

  it('supports sequenceNumber-only Horizon responses', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequenceNumber: '501',
        signers: [
          { key: adopterPublicKey, weight: 1 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequenceNumber: '502',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'sequence-number-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      txHash: 'sequence-number-hash',
      platformOnlyMode: true,
    });
  });

  it('supports top-level threshold keys from Horizon response', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '601',
        signers: [
          { key: adopterPublicKey, weight: 1 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '602',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        low_threshold: 0,
        med_threshold: 2,
        high_threshold: 2,
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'threshold-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      txHash: 'threshold-hash',
      platformOnlyMode: true,
    });
  });

  it('supports signer keys from ed25519PublicKey field', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '651',
        signers: [
          { ed25519PublicKey: adopterPublicKey, weight: 1 },
          { ed25519PublicKey: ownerPublicKey, weight: 1 },
          { ed25519PublicKey: platformKeypair.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '652',
        signers: [
          { ed25519PublicKey: adopterPublicKey, weight: 0 },
          { ed25519PublicKey: ownerPublicKey, weight: 0 },
          { ed25519PublicKey: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'ed25519-fallback-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      txHash: 'ed25519-fallback-hash',
      platformOnlyMode: true,
    });
  });

  it('handles Account instance from loadAccount', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce(new Account(escrowAccountId, '701'))
      .mockResolvedValueOnce({
        sequence: '702',
        signers: [{ key: platformKeypair.publicKey(), weight: 3 }],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'account-instance-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      txHash: 'account-instance-hash',
      platformOnlyMode: true,
    });
  });

  it('ignores invalid signer entries from Horizon and still succeeds', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '801',
        signers: [
          { key: adopterPublicKey, weight: 1 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 1 },
          { weight: 1 },
          { key: Keypair.random().publicKey(), weight: Number.NaN },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '802',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 0 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'invalid-signer-filter-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).resolves.toMatchObject({
      txHash: 'invalid-signer-filter-hash',
      platformOnlyMode: true,
    });
  });

  it('throws when Horizon account response has no sequence value', async () => {
    mockHorizonServer.loadAccount.mockResolvedValueOnce({
      signers: [{ key: platformKeypair.publicKey(), weight: 1 }],
      thresholds: { low: 1, medium: 2, high: 2 },
    });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow('Unable to determine account sequence from Horizon response');
  });

  it('throws when post-submit signer verification fails', async () => {
    mockHorizonServer.loadAccount
      .mockResolvedValueOnce({
        sequence: '301',
        signers: [
          { key: adopterPublicKey, weight: 1 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 2 },
      })
      .mockResolvedValueOnce({
        sequence: '302',
        signers: [
          { key: adopterPublicKey, weight: 0 },
          { key: ownerPublicKey, weight: 1 },
          { key: platformKeypair.publicKey(), weight: 3 },
        ],
        thresholds: { low: 0, medium: 2, high: 2 },
      });

    mockHorizonServer.submitTransaction.mockResolvedValue({ hash: 'bad-hash' });

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow('Dispute signer update verification failed');
  });

  it('re-throws submitTransaction errors from Horizon', async () => {
    mockHorizonServer.loadAccount.mockResolvedValue({
      sequence: '901',
      signers: [
        { key: adopterPublicKey, weight: 1 },
        { key: ownerPublicKey, weight: 1 },
        { key: platformKeypair.publicKey(), weight: 1 },
      ],
      thresholds: { low: 1, medium: 2, high: 2 },
    });

    mockHorizonServer.submitTransaction.mockRejectedValue(new Error('tx_bad_auth'));

    await expect(
      handleDispute(
        {
          escrowAccountId,
          masterSecretKey: platformKeypair.secret(),
        },
        mockHorizonServer,
      ),
    ).rejects.toThrow('tx_bad_auth');
  });
});
