import { Account, Keypair } from '@stellar/stellar-sdk';

import { EscrowStatus, asPercentage } from '../../../src/types/escrow';
import { EscrowManager } from '../../../src/escrow';
import { SdkError, ValidationError } from '../../../src/utils/errors';

describe('EscrowManager', () => {
  const sourceKeypair = Keypair.random();
  const ownerPublicKey = Keypair.random().publicKey();
  const adopterPublicKey = Keypair.random().publicKey();
  const platformPublicKey = Keypair.random().publicKey();

  const horizonClient = {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  const accountManager = {
    create: jest.fn(),
    getBalance: jest.fn(),
  };

  const transactionManager = {
    releaseFunds: jest.fn(),
    handleDispute: jest.fn(),
    getStatus: jest.fn(),
  };

  const manager = new EscrowManager({
    horizonClient,
    accountManager,
    transactionManager,
    masterSecretKey: 'S_TEST_MASTER_SECRET',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('instantiates successfully with injected dependencies', () => {
    expect(manager).toBeInstanceOf(EscrowManager);
  });

  it('delegates createAccount using injected accountManager', async () => {
    accountManager.create.mockResolvedValue({
      accountId: 'GABC1234',
      transactionHash: 'tx-create',
    });

    const result = await manager.createAccount({
      adopterPublicKey,
      ownerPublicKey,
      depositAmount: '10',
    });

    expect(accountManager.create).toHaveBeenCalledWith({
      publicKey: expect.any(String),
      startingBalance: '12.5',
    });
    expect(result.accountId).toBe('GABC1234');
    expect(result.transactionHash).toBe('tx-create');
  });

  it('delegates lockFunds using injected horizon client', async () => {
    horizonClient.loadAccount.mockResolvedValue(new Account(sourceKeypair.publicKey(), '1'));
    horizonClient.submitTransaction.mockResolvedValue({ hash: 'tx-lock' });

    const result = await manager.lockFunds({
      custodianPublicKey: adopterPublicKey,
      ownerPublicKey,
      platformPublicKey,
      sourceKeypair,
      depositAmount: '20',
      durationDays: 2,
    });

    expect(horizonClient.loadAccount).toHaveBeenCalledWith(sourceKeypair.publicKey());
    expect(horizonClient.submitTransaction).toHaveBeenCalledTimes(1);
    expect(result.transactionHash).toBe('tx-lock');
  });

  it('delegates releaseFunds to transactionManager', async () => {
    transactionManager.releaseFunds.mockResolvedValue({
      successful: true,
      txHash: 'tx-release',
      ledger: 10,
      payments: [{ recipient: ownerPublicKey, amount: '50' }],
    });

    const params = {
      escrowAccountId: 'GESCROW123',
      distribution: [{ recipient: ownerPublicKey, percentage: asPercentage(100) }],
    };

    const result = await manager.releaseFunds(params);

    expect(transactionManager.releaseFunds).toHaveBeenCalledWith(params, {
      horizonClient,
      masterSecretKey: 'S_TEST_MASTER_SECRET',
    });
    expect(result.txHash).toBe('tx-release');
  });

  it('delegates handleDispute to transactionManager', async () => {
    const disputeParams = { escrowAccountId: 'GESCROW123' };
    transactionManager.handleDispute.mockResolvedValue({
      accountId: 'GESCROW123',
      pausedAt: new Date('2026-03-29T00:00:00.000Z'),
      platformOnlyMode: true,
      txHash: 'tx-dispute',
    });

    const result = await manager.handleDispute(disputeParams);

    expect(transactionManager.handleDispute).toHaveBeenCalledWith(disputeParams, {
      horizonClient,
      masterSecretKey: 'S_TEST_MASTER_SECRET',
    });
    expect(result.txHash).toBe('tx-dispute');
  });

  it('delegates getBalance to accountManager', async () => {
    accountManager.getBalance.mockResolvedValue('42.5');

    const result = await manager.getBalance(ownerPublicKey);

    expect(accountManager.getBalance).toHaveBeenCalledWith(ownerPublicKey);
    expect(result).toBe('42.5');
  });

  it('delegates getStatus to transactionManager', async () => {
    transactionManager.getStatus.mockResolvedValue(EscrowStatus.FUNDED);

    const result = await manager.getStatus('GESCROW123');

    expect(transactionManager.getStatus).toHaveBeenCalledWith('GESCROW123', {
      horizonClient,
    });
    expect(result).toBe(EscrowStatus.FUNDED);
  });

  it('wraps non-SDK errors in a consistent SdkError', async () => {
    transactionManager.releaseFunds.mockRejectedValue(new Error('network down'));

    await expect(
      manager.releaseFunds({
        escrowAccountId: 'GESCROW123',
        distribution: [{ recipient: ownerPublicKey, percentage: asPercentage(100) }],
      }),
    ).rejects.toMatchObject({
      code: 'ESCROW_MANAGER_ERROR',
      message: 'EscrowManager.releaseFunds failed: network down',
    });
  });

  it('rethrows existing SDK errors without re-wrapping', async () => {
    const validationError = new ValidationError('publicKey', 'invalid public key');
    accountManager.getBalance.mockRejectedValue(validationError);

    await expect(manager.getBalance('INVALID')).rejects.toBe(validationError);
    await expect(manager.getBalance('INVALID')).rejects.toBeInstanceOf(SdkError);
  });
});
