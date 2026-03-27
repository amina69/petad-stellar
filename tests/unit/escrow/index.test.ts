import {
  Account,
  Keypair,
} from '@stellar/stellar-sdk';
import {
  createEscrowAccount,
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

describe('escrow module placeholders', () => {
  it('exports callable placeholder functions', () => {
    expect(createEscrowAccount()).toBeUndefined();
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

