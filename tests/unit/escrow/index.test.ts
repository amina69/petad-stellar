import {
  Account,
  Keypair,
} from '@stellar/stellar-sdk';
import {
  createEscrowAccount,
  calculateStartingBalance,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
  releaseFunds,
} from '../../../src/escrow';
import { asPercentage } from '../../../src/types/escrow';
import { HorizonSubmitError } from '../../../src/utils/errors';

function createHorizonAccount(accountId: string, balance: string, sequence = '1') {
  return Object.assign(new Account(accountId, sequence), {
    balances: [{ asset_type: 'native', balance }],
  });
}

function createServer(balance: string) {
  return {
    loadAccount: jest.fn(async (accountId: string) => createHorizonAccount(accountId, balance)),
    submitTransaction: jest.fn(async (_transaction: unknown) => ({
      successful: true,
      hash: 'tx-hash-123',
      ledger: 123456,
    })),
  };
}

describe('calculateStartingBalance', () => {
  describe('happy path', () => {
    it('calculates starting balance with 10 XLM deposit', () => {
      // minimumReserve(3,0,0) = 2.5 XLM + 10 XLM deposit = 12.5 XLM
      expect(calculateStartingBalance('10')).toBe('12.5');
    });

    it('calculates starting balance with 100 XLM deposit', () => {
      // 2.5 + 100 = 102.5
      expect(calculateStartingBalance('100')).toBe('102.5');
    });

    it('calculates starting balance with 0.5 XLM deposit', () => {
      // 2.5 + 0.5 = 3.0
      expect(calculateStartingBalance('0.5')).toBe('3');
    });

    it('calculates starting balance with 1 XLM deposit', () => {
      // 2.5 + 1 = 3.5
      expect(calculateStartingBalance('1')).toBe('3.5');
    });

    it('calculates starting balance with 0.0000001 XLM deposit (smallest unit)', () => {
      // 2.5 + 0.0000001 = 2.5000001
      expect(calculateStartingBalance('0.0000001')).toBe('2.5000001');
    });

    it('calculates starting balance with 10000 XLM deposit', () => {
      // 2.5 + 10000 = 10002.5
      expect(calculateStartingBalance('10000')).toBe('10002.5');
    });

    it('handles decimal amounts with 7 decimal precision', () => {
      // 2.5 + 1.2345678 = 3.7345678 -> 3.7345678 (max 7 decimals)
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
    adopterPublicKey: 'GABCKC7DVTRJKDSY5QD4ZYY2CG2KWQNSVCBNWXQPG5AFKXCMYEUHONL3',
    ownerPublicKey: 'GBVXXYKKD7CMQ7Q5UBQK47SEHELTRWGXAM2DXWJ73T7IWKGDVT2VMC6G',
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
        startingBalance: '12.5', // 2.5 minimum + 10 deposit
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

      // Test with 50 XLM deposit
      await createEscrowAccount({ ...validParams, depositAmount: '50' }, mockAccountManager);

      expect(mockAccountManager.create).toHaveBeenCalledWith({
        publicKey: expect.any(String),
        startingBalance: '52.5', // 2.5 + 50
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
  it('exports callable placeholder functions', () => {
    expect(lockCustodyFunds()).toBeUndefined();
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});

describe('releaseFunds', () => {
  it('releases the full fetched balance on the happy path', async () => {
    const source = Keypair.random();
    const recipient = Keypair.random();
    const server = createServer('500.0000000');

    const result = await releaseFunds(
      {
        escrowAccountId: source.publicKey(),
        sourceSecretKey: source.secret(),
        distribution: [
          { recipient: recipient.publicKey(), percentage: asPercentage(100) },
        ],
      },
      { server },
    );

    expect(result).toEqual({
      successful: true,
      txHash: 'tx-hash-123',
      ledger: 123456,
      payments: [
        { recipient: recipient.publicKey(), amount: '500.0000000' },
      ],
    });

    const submittedTransaction = server.submitTransaction.mock.calls[0]?.[0] as {
      operations: Array<Record<string, unknown>>;
    };
    expect(submittedTransaction.operations).toHaveLength(1);
    expect(submittedTransaction.operations[0]).toMatchObject({
      type: 'payment',
      destination: recipient.publicKey(),
      amount: '500.0000000',
    });
  });

  it('submits a 60/40 split as two exact payment operations', async () => {
    const source = Keypair.random();
    const recipientA = Keypair.random();
    const recipientB = Keypair.random();
    const server = createServer('999.0000000');

    const result = await releaseFunds(
      {
        escrowAccountId: source.publicKey(),
        sourceSecretKey: source.secret(),
        balance: '500.0000000',
        distribution: [
          { recipient: recipientA.publicKey(), percentage: asPercentage(60) },
          { recipient: recipientB.publicKey(), percentage: asPercentage(40) },
        ],
      },
      { server },
    );

    expect(result.payments).toEqual([
      { recipient: recipientA.publicKey(), amount: '300.0000000' },
      { recipient: recipientB.publicKey(), amount: '200.0000000' },
    ]);

    const submittedTransaction = server.submitTransaction.mock.calls[0]?.[0] as {
      operations: Array<Record<string, unknown>>;
    };
    expect(submittedTransaction.operations).toHaveLength(2);
    expect(submittedTransaction.operations[0]).toMatchObject({
      type: 'payment',
      destination: recipientA.publicKey(),
      amount: '300.0000000',
    });
    expect(submittedTransaction.operations[1]).toMatchObject({
      type: 'payment',
      destination: recipientB.publicKey(),
      amount: '200.0000000',
    });
  });

  it('supports a 100% refund to a single recipient', async () => {
    const source = Keypair.random();
    const refundRecipient = Keypair.random();
    const server = createServer('999.0000000');

    const result = await releaseFunds(
      {
        escrowAccountId: source.publicKey(),
        sourceSecretKey: source.secret(),
        balance: '125.0000000',
        distribution: [
          { recipient: refundRecipient.publicKey(), percentage: asPercentage(100) },
        ],
      },
      { server },
    );

    expect(result.payments).toEqual([
      { recipient: refundRecipient.publicKey(), amount: '125.0000000' },
    ]);
    expect(server.loadAccount).toHaveBeenCalledTimes(1);
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('does not retry when submit fails with a non-retryable SdkError', async () => {
    const source = Keypair.random();
    const recipient = Keypair.random();
    const server = {
      loadAccount: jest.fn(async (accountId: string) =>
        createHorizonAccount(accountId, '500.0000000'),
      ),
      submitTransaction: jest.fn(async (_transaction: unknown) => {
        throw new HorizonSubmitError('tx_bad_auth');
      }),
    };

    await expect(
      releaseFunds(
        {
          escrowAccountId: source.publicKey(),
          sourceSecretKey: source.secret(),
          balance: '500.0000000',
          distribution: [
            { recipient: recipient.publicKey(), percentage: asPercentage(100) },
          ],
        },
        { server, maxSubmitAttempts: 3 },
      ),
    ).rejects.toMatchObject({
      code: 'HORIZON_SUBMIT_ERROR',
      retryable: false,
      resultCode: 'tx_bad_auth',
    });

    expect(server.loadAccount).toHaveBeenCalledTimes(1);
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });
});

