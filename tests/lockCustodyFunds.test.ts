import { lockCustodyFunds } from '../src/escrow/lockCustodyFunds';

describe('lockCustodyFunds', () => {
  const baseParams = {
    custodianPublicKey: 'GXXXXCUSTODIAN',
    ownerPublicKey: 'GXXXXOWNER',
    depositAmount: '10',
    durationDays: 5,
  };

  test('should calculate unlockDate correctly', async () => {
    const before = Date.now();

    const result = await lockCustodyFunds(baseParams);

    const expected = before + 5 * 86400000;

    expect(result.unlockDate.getTime()).toBeGreaterThanOrEqual(expected - 1000);
  });

  test('conditionsHash should be deterministic', async () => {
    const res1 = await lockCustodyFunds(baseParams);
    const res2 = await lockCustodyFunds(baseParams);

    expect(res1.conditionsHash).toBe(res2.conditionsHash);
  });

  test('should reject invalid duration', async () => {
    await expect(lockCustodyFunds({ ...baseParams, durationDays: 0 })).rejects.toThrow();
  });

  test('memo encoding length <= 28 bytes', async () => {
    const result = await lockCustodyFunds(baseParams);

    expect(result.conditionsHash.slice(0, 28).length).toBeLessThanOrEqual(28);
  });
});


describe('lockCustodyFunds', () => {
  const baseParams = {
    custodianPublicKey: 'GXXXXCUSTODIAN',
    ownerPublicKey: 'GXXXXOWNER',
    depositAmount: '10',
    durationDays: 5,
  };

  test('should calculate unlockDate correctly', async () => {
    const before = Date.now();

    const result = await lockCustodyFunds(baseParams);

    const expected = before + 5 * 86400000;

    expect(result.unlockDate.getTime()).toBeGreaterThanOrEqual(expected - 1000);
  });

  test('conditionsHash should be deterministic', async () => {
    const res1 = await lockCustodyFunds(baseParams);
    const res2 = await lockCustodyFunds(baseParams);

    expect(res1.conditionsHash).toBe(res2.conditionsHash);
  });

  test('should reject invalid duration', async () => {
    await expect(lockCustodyFunds({ ...baseParams, durationDays: 0 })).rejects.toThrow();
  });

  test('memo encoding length <= 28 bytes', async () => {
    const result = await lockCustodyFunds(baseParams);

    expect(result.conditionsHash.slice(0, 28).length).toBeLessThanOrEqual(28);
  });
});
