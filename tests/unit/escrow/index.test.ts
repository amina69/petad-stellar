import {
  createEscrowAccount,
  encodeMemo,
  decodeMemo,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';

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
