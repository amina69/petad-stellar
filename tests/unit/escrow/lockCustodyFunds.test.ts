import { Keypair, Account } from '@stellar/stellar-sdk';
import { lockCustodyFunds } from '../../../src/escrow';
import { ValidationError } from '../../../src/utils/errors';

describe('lockCustodyFunds', () => {
  const sourceKeypair = Keypair.random();

  const mockHorizonServer = {
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  const baseParams = {
    custodianPublicKey: Keypair.random().publicKey(),
    ownerPublicKey: Keypair.random().publicKey(),
    platformPublicKey: Keypair.random().publicKey(),
    sourceKeypair,
    depositAmount: '100',
    durationDays: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    //  FIX: proper Account instance
    mockHorizonServer.loadAccount.mockResolvedValue(
      new Account(sourceKeypair.publicKey(), '1')
    );

    mockHorizonServer.submitTransaction.mockResolvedValue({
      hash: 'mock-hash',
    });
  });

  // ─── HAPPY PATH ─────────────────────────────────────────────

  it('should lock funds successfully', async () => {
    const result = await lockCustodyFunds(baseParams, mockHorizonServer);

    expect(result).toHaveProperty('unlockDate');
    expect(result).toHaveProperty('conditionsHash');
    expect(result).toHaveProperty('escrowPublicKey');
    expect(result).toHaveProperty('transactionHash');
  });

  // ─── UNLOCK DATE ────────────────────────────────────────────

  it('should calculate unlockDate correctly', async () => {
    const durationDays = 5;

    const result = await lockCustodyFunds(
      { ...baseParams, durationDays },
      mockHorizonServer
    );

    const expected = Date.now() + durationDays * 86400000;

    expect(result.unlockDate.getTime()).toBeGreaterThan(expected - 1000);
  });

  // ─── HASH TESTS ─────────────────────────────────────────────

  it('should generate deterministic conditionsHash', async () => {
    const result1 = await lockCustodyFunds(baseParams, mockHorizonServer);
    const result2 = await lockCustodyFunds(baseParams, mockHorizonServer);

    expect(result1.conditionsHash).toBe(result2.conditionsHash);
  });

  it('should produce same hash for same inputs (idempotency)', async () => {
    const r1 = await lockCustodyFunds(baseParams, mockHorizonServer);
    const r2 = await lockCustodyFunds(baseParams, mockHorizonServer);

    expect(r1.conditionsHash).toEqual(r2.conditionsHash);
  });

  // ─── SERVER CALLS ───────────────────────────────────────────

  it('should call horizon server', async () => {
    await lockCustodyFunds(baseParams, mockHorizonServer);

    expect(mockHorizonServer.loadAccount).toHaveBeenCalled();
    expect(mockHorizonServer.submitTransaction).toHaveBeenCalled();
  });

  // ─── VALIDATION ─────────────────────────────────────────────

  it('should throw error for invalid custodian key', async () => {
    await expect(
      lockCustodyFunds(
        { ...baseParams, custodianPublicKey: 'invalid' },
        mockHorizonServer
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should throw error for invalid owner key', async () => {
    await expect(
      lockCustodyFunds(
        { ...baseParams, ownerPublicKey: 'invalid' },
        mockHorizonServer
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should throw error for invalid platform key', async () => {
    await expect(
      lockCustodyFunds(
        { ...baseParams, platformPublicKey: 'invalid' },
        mockHorizonServer
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should throw error for invalid depositAmount', async () => {
    await expect(
      lockCustodyFunds(
        { ...baseParams, depositAmount: 'invalid' },
        mockHorizonServer
      )
    ).rejects.toThrow(ValidationError);
  });

  it('should throw error for invalid durationDays', async () => {
    await expect(
      lockCustodyFunds(
        { ...baseParams, durationDays: 0 },
        mockHorizonServer
      )
    ).rejects.toThrow(ValidationError);
  });

  // ─── EDGE CASES ─────────────────────────────────────────────

  it('should handle large durationDays', async () => {
    const result = await lockCustodyFunds(
      { ...baseParams, durationDays: 3650 },
      mockHorizonServer
    );

    expect(result.unlockDate).toBeInstanceOf(Date);
  });

  it('should handle small valid amount', async () => {
    const result = await lockCustodyFunds(
      { ...baseParams, depositAmount: '0.0000001' },
      mockHorizonServer
    );

    expect(result.conditionsHash).toBeDefined();
  });
});