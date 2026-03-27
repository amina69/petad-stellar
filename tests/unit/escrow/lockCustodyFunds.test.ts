import { Keypair, Networks, Account, Memo } from '@stellar/stellar-sdk';
import {
  lockCustodyFunds,
  hashData,
  LockCustodyFundsParams,
} from '../../../src/escrow/lockCustodyFunds';
import type { Signer } from '../../../src/types/escrow';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const custodianKp = Keypair.random();
const ownerKp     = Keypair.random();
const platformKp  = Keypair.random();

function makeParams(overrides: Partial<LockCustodyFundsParams> = {}): LockCustodyFundsParams {
  return {
    custodianPublicKey: custodianKp.publicKey(),
    ownerPublicKey:     ownerKp.publicKey(),
    platformPublicKey:  platformKp.publicKey(),
    depositAmount:      '100.00',
    durationDays:       30,
    escrowAccount:      new Account(platformKp.publicKey(), '0'),
    networkPassphrase:  Networks.TESTNET,
    ...overrides,
  };
}

// ── hashData() ────────────────────────────────────────────────────────────────

describe('hashData()', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashData({ noViolations: true, petReturned: true });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input always yields same hash', () => {
    expect(hashData({ noViolations: true, petReturned: true }))
      .toBe(hashData({ noViolations: true, petReturned: true }));
  });

  it('is key-order invariant', () => {
    const h1 = hashData({ noViolations: true, petReturned: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h2 = hashData({ petReturned: true, noViolations: true } as any);
    expect(h1).toBe(h2);
  });

  it('changes when conditions differ', () => {
    expect(hashData({ noViolations: true, petReturned: true }))
      .not.toBe(hashData({ noViolations: false, petReturned: true }));
  });
});

// ── unlockDate calculation ────────────────────────────────────────────────────

describe('lockCustodyFunds() — unlockDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('is exactly durationDays in the future', () => {
    const { unlockDate } = lockCustodyFunds(makeParams({ durationDays: 30 }));
    expect(unlockDate.toISOString()).toBe('2025-01-31T00:00:00.000Z');
  });

  it('handles durationDays = 1', () => {
    const { unlockDate } = lockCustodyFunds(makeParams({ durationDays: 1 }));
    expect(unlockDate.toISOString()).toBe('2025-01-02T00:00:00.000Z');
  });

  it('handles durationDays = 365', () => {
    const { unlockDate } = lockCustodyFunds(makeParams({ durationDays: 365 }));
    expect(unlockDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

// ── conditionsHash determinism ────────────────────────────────────────────────

describe('lockCustodyFunds() — conditionsHash', () => {
  it('is deterministic across calls', () => {
    const r1 = lockCustodyFunds(makeParams());
    const r2 = lockCustodyFunds(makeParams());
    expect(r1.conditionsHash).toBe(r2.conditionsHash);
  });

  it('is a valid 64-char hex string', () => {
    const { conditionsHash } = lockCustodyFunds(makeParams());
    expect(conditionsHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── Memo encoding ─────────────────────────────────────────────────────────────

describe('lockCustodyFunds() — memo encoding', () => {
  it('memo is the first 28 chars of conditionsHash', () => {
    const result = lockCustodyFunds(makeParams());
    const memo   = result.transaction.memo;
    expect(memo.type).toBe(Memo.text('x').type);
    expect(memo.value as string).toBe(result.conditionsHash.substring(0, 28));
  });

  it('memo is consistent across calls', () => {
    const r1 = lockCustodyFunds(makeParams());
    const r2 = lockCustodyFunds(makeParams());
    expect(r1.transaction.memo.value as string)
      .toBe(r2.transaction.memo.value as string);
  });
});

// ── Signers & Thresholds (repo types) ────────────────────────────────────────

describe('lockCustodyFunds() — signers & thresholds', () => {
  it('returns 3 signers with weight 1', () => {
    const { signers } = lockCustodyFunds(makeParams());
    expect(signers).toHaveLength(3);
    signers.forEach((s: Signer) => expect(s.weight).toBe(1));
  });

  it('signers include custodian, owner and platform', () => {
    const p = makeParams();
    const { signers } = lockCustodyFunds(p);
    const keys = signers.map(s => s.publicKey);
    expect(keys).toContain(p.custodianPublicKey);
    expect(keys).toContain(p.ownerPublicKey);
    expect(keys).toContain(p.platformPublicKey);
  });

  it('thresholds are all 2 (2-of-3 multisig)', () => {
    const { thresholds } = lockCustodyFunds(makeParams());
    expect(thresholds).toEqual({ low: 2, medium: 2, high: 2 });
  });
});

// ── Input validation ──────────────────────────────────────────────────────────

describe('lockCustodyFunds() — input validation', () => {
  it('throws on invalid custodianPublicKey', () => {
    expect(() => lockCustodyFunds(makeParams({ custodianPublicKey: 'bad' })))
      .toThrow('Invalid custodianPublicKey');
  });

  it('throws on empty ownerPublicKey', () => {
    expect(() => lockCustodyFunds(makeParams({ ownerPublicKey: '' })))
      .toThrow('Invalid ownerPublicKey');
  });

  it('throws on invalid platformPublicKey', () => {
    expect(() => lockCustodyFunds(makeParams({ platformPublicKey: 'GABC' })))
      .toThrow('Invalid platformPublicKey');
  });

  it('throws on zero depositAmount', () => {
    expect(() => lockCustodyFunds(makeParams({ depositAmount: '0' })))
      .toThrow('depositAmount must be a positive number');
  });

  it('throws on negative depositAmount', () => {
    expect(() => lockCustodyFunds(makeParams({ depositAmount: '-5' })))
      .toThrow('depositAmount must be a positive number');
  });

  it('throws on non-numeric depositAmount', () => {
    expect(() => lockCustodyFunds(makeParams({ depositAmount: 'abc' })))
      .toThrow('depositAmount must be a positive number');
  });

  it('throws on durationDays = 0', () => {
    expect(() => lockCustodyFunds(makeParams({ durationDays: 0 })))
      .toThrow('durationDays must be a positive integer');
  });

  it('throws on negative durationDays', () => {
    expect(() => lockCustodyFunds(makeParams({ durationDays: -5 })))
      .toThrow('durationDays must be a positive integer');
  });

  it('throws on fractional durationDays', () => {
    expect(() => lockCustodyFunds(makeParams({ durationDays: 1.5 })))
      .toThrow('durationDays must be a positive integer');
  });
});

// ── Transaction structure ─────────────────────────────────────────────────────

describe('lockCustodyFunds() — transaction structure', () => {
  it('has 4 operations', () => {
    const { transaction } = lockCustodyFunds(makeParams());
    expect(transaction.operations).toHaveLength(4);
  });

  it('first op is createAccount', () => {
    const { transaction } = lockCustodyFunds(makeParams());
    expect(transaction.operations[0].type).toBe('createAccount');
  });

  it('generates a unique escrowPublicKey each call', () => {
    const r1 = lockCustodyFunds(makeParams());
    const r2 = lockCustodyFunds(makeParams());
    expect(r1.escrowPublicKey).not.toBe(r2.escrowPublicKey);
  });
});