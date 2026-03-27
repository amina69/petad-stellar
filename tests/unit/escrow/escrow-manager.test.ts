import { EscrowManager } from '../../../src/escrow/escrow-manager';
import { ValidationError, SdkError } from '../../../src/utils/errors';
import { EscrowStatus } from '../../../src/types/escrow';
import type {
  EscrowManagerDeps,
  IHorizonClient,
  IAccountManager,
  ITransactionManager,
} from '../../../src/escrow/types';

const VALID_PUBLIC_KEY = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
const VALID_SECRET_KEY = 'SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

function createMockDeps(overrides: Partial<EscrowManagerDeps> = {}): EscrowManagerDeps {
  const horizonClient: IHorizonClient = {
    getBalance: jest.fn().mockResolvedValue({
      accountId: VALID_PUBLIC_KEY,
      balance: '100.0000000',
      lastModifiedLedger: 1000,
    }),
    getAccountInfo: jest.fn().mockResolvedValue({
      accountId: VALID_PUBLIC_KEY,
      balance: '100.0000000',
      signers: [],
      thresholds: { low: 0, medium: 0, high: 0 },
      sequenceNumber: '1',
      exists: true,
    }),
  };

  const accountManager: IAccountManager = {
    createEscrowAccount: jest.fn().mockResolvedValue({
      accountId: VALID_PUBLIC_KEY,
      transactionHash: 'txhash123',
      signers: [],
      thresholds: { low: 0, medium: 0, high: 0 },
    }),
  };

  const transactionManager: ITransactionManager = {
    lockFunds: jest.fn().mockResolvedValue({
      successful: true,
      hash: 'lockhash123',
      ledger: 5000,
    }),
    releaseFunds: jest.fn().mockResolvedValue({
      successful: true,
      txHash: 'releasehash123',
      ledger: 5001,
      payments: [],
    }),
    handleDispute: jest.fn().mockResolvedValue({
      accountId: VALID_PUBLIC_KEY,
      pausedAt: new Date(),
      platformOnlyMode: true,
      txHash: 'disputehash123',
    }),
  };

  return {
    horizonClient,
    accountManager,
    transactionManager,
    masterSecretKey: VALID_SECRET_KEY,
    ...overrides,
  };
}

describe('EscrowManager', () => {
  describe('constructor', () => {
    it('creates an instance with valid deps', () => {
      const manager = new EscrowManager(createMockDeps());
      expect(manager).toBeInstanceOf(EscrowManager);
    });

    it('throws ValidationError when masterSecretKey is empty', () => {
      expect(() => new EscrowManager(createMockDeps({ masterSecretKey: '' }))).toThrow(
        ValidationError,
      );
    });
  });

  describe('createAccount', () => {
    it('delegates to accountManager.createEscrowAccount', async () => {
      const deps = createMockDeps();
      const manager = new EscrowManager(deps);
      const params = {
        adopterPublicKey: VALID_PUBLIC_KEY,
        ownerPublicKey: VALID_PUBLIC_KEY,
        depositAmount: '100',
      };
      const result = await manager.createAccount(params);
      expect(deps.accountManager.createEscrowAccount).toHaveBeenCalledWith(params);
      expect(result.accountId).toBe(VALID_PUBLIC_KEY);
    });

    it('wraps non-SDK errors', async () => {
      const deps = createMockDeps();
      (deps.accountManager.createEscrowAccount as jest.Mock).mockRejectedValue(
        new Error('network failure'),
      );
      const manager = new EscrowManager(deps);
      await expect(
        manager.createAccount({
          adopterPublicKey: VALID_PUBLIC_KEY,
          ownerPublicKey: VALID_PUBLIC_KEY,
          depositAmount: '100',
        }),
      ).rejects.toThrow(SdkError);
    });

    it('passes through SdkError instances', async () => {
      const deps = createMockDeps();
      const sdkErr = new SdkError('already exists', 'DUPLICATE', false);
      (deps.accountManager.createEscrowAccount as jest.Mock).mockRejectedValue(sdkErr);
      const manager = new EscrowManager(deps);
      await expect(
        manager.createAccount({
          adopterPublicKey: VALID_PUBLIC_KEY,
          ownerPublicKey: VALID_PUBLIC_KEY,
          depositAmount: '100',
        }),
      ).rejects.toBe(sdkErr);
    });
  });

  describe('lockFunds', () => {
    it('delegates to transactionManager.lockFunds with masterSecretKey', async () => {
      const deps = createMockDeps();
      const manager = new EscrowManager(deps);
      await manager.lockFunds(VALID_PUBLIC_KEY, '50');
      expect(deps.transactionManager.lockFunds).toHaveBeenCalledWith(
        VALID_PUBLIC_KEY,
        '50',
        VALID_SECRET_KEY,
      );
    });

    it('throws ValidationError for invalid escrowAccountId', async () => {
      const manager = new EscrowManager(createMockDeps());
      await expect(manager.lockFunds('invalid', '50')).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError for invalid amount', async () => {
      const manager = new EscrowManager(createMockDeps());
      await expect(manager.lockFunds(VALID_PUBLIC_KEY, '-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('releaseFunds', () => {
    it('delegates to transactionManager.releaseFunds', async () => {
      const deps = createMockDeps();
      const manager = new EscrowManager(deps);
      const params = { escrowAccountId: VALID_PUBLIC_KEY, distribution: [] };
      await manager.releaseFunds(params);
      expect(deps.transactionManager.releaseFunds).toHaveBeenCalledWith(params, VALID_SECRET_KEY);
    });
  });

  describe('handleDispute', () => {
    it('delegates to transactionManager.handleDispute', async () => {
      const deps = createMockDeps();
      const manager = new EscrowManager(deps);
      const params = { escrowAccountId: VALID_PUBLIC_KEY };
      await manager.handleDispute(params);
      expect(deps.transactionManager.handleDispute).toHaveBeenCalledWith(
        params,
        VALID_SECRET_KEY,
      );
    });
  });

  describe('getBalance', () => {
    it('delegates to horizonClient.getBalance', async () => {
      const deps = createMockDeps();
      const manager = new EscrowManager(deps);
      const result = await manager.getBalance(VALID_PUBLIC_KEY);
      expect(deps.horizonClient.getBalance).toHaveBeenCalledWith(VALID_PUBLIC_KEY);
      expect(result.balance).toBe('100.0000000');
    });

    it('throws ValidationError for invalid escrowAccountId', async () => {
      const manager = new EscrowManager(createMockDeps());
      await expect(manager.getBalance('bad')).rejects.toThrow(ValidationError);
    });
  });

  describe('getStatus', () => {
    it('returns FUNDED when account exists with positive balance', async () => {
      const manager = new EscrowManager(createMockDeps());
      const status = await manager.getStatus(VALID_PUBLIC_KEY);
      expect(status).toBe(EscrowStatus.FUNDED);
    });

    it('returns NOT_FOUND when account does not exist', async () => {
      const deps = createMockDeps();
      (deps.horizonClient.getAccountInfo as jest.Mock).mockResolvedValue({
        accountId: VALID_PUBLIC_KEY,
        balance: '0',
        signers: [],
        thresholds: { low: 0, medium: 0, high: 0 },
        sequenceNumber: '0',
        exists: false,
      });
      const manager = new EscrowManager(deps);
      const status = await manager.getStatus(VALID_PUBLIC_KEY);
      expect(status).toBe(EscrowStatus.NOT_FOUND);
    });

    it('returns CREATED when balance is zero', async () => {
      const deps = createMockDeps();
      (deps.horizonClient.getAccountInfo as jest.Mock).mockResolvedValue({
        accountId: VALID_PUBLIC_KEY,
        balance: '0',
        signers: [],
        thresholds: { low: 0, medium: 0, high: 0 },
        sequenceNumber: '1',
        exists: true,
      });
      const manager = new EscrowManager(deps);
      const status = await manager.getStatus(VALID_PUBLIC_KEY);
      expect(status).toBe(EscrowStatus.CREATED);
    });

    it('throws ValidationError for invalid escrowAccountId', async () => {
      const manager = new EscrowManager(createMockDeps());
      await expect(manager.getStatus('bad')).rejects.toThrow(ValidationError);
    });
  });
});
