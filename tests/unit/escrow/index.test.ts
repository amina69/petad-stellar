import {
  createEscrowAccount,
  encodeMemo,
  decodeMemo,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { ValidationError } from '../../../src/utils/errors';
import { CreateEscrowParams } from '../../../src/types/escrow';
import { InsufficientBalanceError } from '../../../src/utils/errors';
import { Account, Keypair, Operation } from '@stellar/stellar-sdk';

describe('escrow memo encoding', () => {
  it('uses MEMO_TEXT when short IDs fit within the 28-byte memo text limit', () => {
    const data = { adoptionId: 'a', petId: 'b' };

    const memo = encodeMemo(data);

    expect(memo.type).toBe('MEMO_TEXT');
    expect(Buffer.byteLength(memo.value, 'utf8')).toBeLessThanOrEqual(28);
    expect(decodeMemo(memo)).toEqual(data);
  });

  it('uses MEMO_HASH when long IDs exceed the 28-byte memo text limit', () => {
    const data = {
      adoptionId: 'adoption-id-that-is-too-long-for-memo-text',
      petId: 'pet-id-that-is-also-too-long',
    };

    const memo = encodeMemo(data);

    expect(memo.type).toBe('MEMO_HASH');
    expect(memo.value).toHaveLength(32);
    expect(decodeMemo(memo)).toEqual(data);
  });

  it('round-trips short metadata via decodeMemo(encodeMemo(data))', () => {
    const data = { adoptionId: 'a', petId: 'b' };

    expect(decodeMemo(encodeMemo(data))).toEqual(data);
  });

  it('round-trips long metadata via decodeMemo(encodeMemo(data))', () => {
    const data = {
      adoptionId: 'adoption-id-that-is-too-long-for-memo-text',
      petId: 'pet-id-that-is-also-too-long',
    };

    expect(decodeMemo(encodeMemo(data))).toEqual(data);
  });
});

describe('createEscrowAccount', () => {
  it('encodes metadata into the escrow memo when metadata is provided', () => {
    const result = createEscrowAccount({
      adopterPublicKey: 'GADOPTER',
      ownerPublicKey: 'GOWNER',
      depositAmount: '100',
      metadata: { adoptionId: 'a', petId: 'b' },
    });

    expect(result.memo).toEqual(encodeMemo({ adoptionId: 'a', petId: 'b' }));
  });

  it('keeps the remaining escrow exports callable', () => {
    expect(lockCustodyFunds()).toBeUndefined();
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
