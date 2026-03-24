import {
  asPercentage,
  Distribution,
  ReleaseParams,
  ReleaseResult,
} from '../../../src/types/escrow';


// ---------------------------------------------------------------------------
// asPercentage — branded runtime validator
// ---------------------------------------------------------------------------

describe('asPercentage', () => {
  describe('happy path', () => {
    it('accepts 0', () => {
      expect(asPercentage(0)).toBe(0);
    });

    it('accepts 100', () => {
      expect(asPercentage(100)).toBe(100);
    });

    it('accepts a midpoint value (50)', () => {
      expect(asPercentage(50)).toBe(50);
    });

    it('accepts fractional values within range (33.33)', () => {
      expect(asPercentage(33.33)).toBeCloseTo(33.33);
    });
  });

  describe('validation errors', () => {
    it('throws RangeError for value below 0', () => {
      expect(() => asPercentage(-1)).toThrow(RangeError);
      expect(() => asPercentage(-1)).toThrow(
        'Percentage must be between 0 and 100, got -1',
      );
    });

    it('throws RangeError for value above 100', () => {
      expect(() => asPercentage(101)).toThrow(RangeError);
      expect(() => asPercentage(101)).toThrow(
        'Percentage must be between 0 and 100, got 101',
      );
    });

    it('throws for NaN', () => {
      expect(() => asPercentage(NaN)).toThrow(RangeError);
    });

    it('throws for Infinity', () => {
      expect(() => asPercentage(Infinity)).toThrow(RangeError);
    });

    it('throws for -Infinity', () => {
      expect(() => asPercentage(-Infinity)).toThrow(RangeError);
    });
  });

  describe('edge cases', () => {
    it('accepts exactly 0 (lower boundary)', () => {
      expect(() => asPercentage(0)).not.toThrow();
    });

    it('accepts exactly 100 (upper boundary)', () => {
      expect(() => asPercentage(100)).not.toThrow();
    });

    it('rejects 100.0001 (just above upper boundary)', () => {
      expect(() => asPercentage(100.0001)).toThrow(RangeError);
    });

    it('rejects -0.0001 (just below lower boundary)', () => {
      expect(() => asPercentage(-0.0001)).toThrow(RangeError);
    });
  });
});

// ---------------------------------------------------------------------------
// Distribution — structural conformance
// ---------------------------------------------------------------------------

describe('Distribution', () => {
  it('conforms to the expected shape', () => {
    const dist: Distribution = {
      recipient: 'GABCDE...1234',
      percentage: asPercentage(50),
    };
    expect(dist.recipient).toBe('GABCDE...1234');
    expect(dist.percentage).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// ReleaseParams — structural conformance
// ---------------------------------------------------------------------------

describe('ReleaseParams', () => {
  it('holds escrowAccountId and a distribution array', () => {
    const params: ReleaseParams = {
      escrowAccountId: 'GESCROW...5678',
      distribution: [
        { recipient: 'GADOPTER...', percentage: asPercentage(70) },
        { recipient: 'GOWNER...', percentage: asPercentage(30) },
      ],
    };
    expect(params.distribution).toHaveLength(2);
    expect(params.distribution[0].percentage).toBe(70);
    expect(params.distribution[1].percentage).toBe(30);
  });

  it('allows an empty distribution array', () => {
    const params: ReleaseParams = {
      escrowAccountId: 'GESCROW...5678',
      distribution: [],
    };
    expect(params.distribution).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ReleaseResult — structural conformance
// ---------------------------------------------------------------------------

describe('ReleaseResult', () => {
  it('conforms to the expected shape on success', () => {
    const result: ReleaseResult = {
      successful: true,
      txHash: 'abc123txhash',
      ledger: 55000,
      payments: [
        { recipient: 'GADOPTER...', amount: '70.0000000' },
        { recipient: 'GOWNER...', amount: '30.0000000' },
      ],
    };
    expect(result.successful).toBe(true);
    expect(result.txHash).toBe('abc123txhash');
    expect(result.ledger).toBe(55000);
    expect(result.payments).toHaveLength(2);
  });

  it('conforms to the expected shape on failure', () => {
    const result: ReleaseResult = {
      successful: false,
      txHash: '',
      ledger: 0,
      payments: [],
    };
    expect(result.successful).toBe(false);
    expect(result.payments).toHaveLength(0);
  });
});
