import * as networkTypes from '../../../src/types/network';
import type {
  AnchorParams,
  AnchorResult,
  VerifyParams,
  VerifyResult,
} from '../../../src/types/network';

// Feature: anchor-verify-types, Property 1: All four interfaces are exported from the module
describe('module exports', () => {
  it('exports AnchorParams, AnchorResult, VerifyParams, and VerifyResult', () => {
    // TypeScript interfaces are erased at runtime, so we verify via type-level usage below.
    // This test confirms the module itself is importable and the names are in scope.
    expect(networkTypes).toBeDefined();
  });
});

// Feature: anchor-verify-types, Property 2: AnchorParams accepts any conforming object
describe('AnchorParams', () => {
  it('accepts an object with hash and eventType', () => {
    const params: AnchorParams = { hash: 'abc123', eventType: 'TRUST_HASH' };
    expect(params.hash).toBe('abc123');
    expect(params.eventType).toBe('TRUST_HASH');
  });

  it('accepts an object with hash, eventType, and optional metadata', () => {
    const params: AnchorParams = {
      hash: 'abc123',
      eventType: 'TRUST_HASH',
      metadata: { source: 'test', count: 1 },
    };
    expect(params.metadata).toEqual({ source: 'test', count: 1 });
  });
});

// Feature: anchor-verify-types, Property 3: AnchorResult accepts any conforming object
describe('AnchorResult', () => {
  it('accepts an object with txHash, ledger, verified, and timestamp', () => {
    const ts = new Date('2024-01-01T00:00:00Z');
    const result: AnchorResult = {
      txHash: 'tx_abc',
      ledger: 42,
      verified: true,
      timestamp: ts,
    };
    expect(result.txHash).toBe('tx_abc');
    expect(result.ledger).toBe(42);
    expect(result.verified).toBe(true);
    expect(result.timestamp).toBe(ts);
  });
});

// Feature: anchor-verify-types, Property 4: VerifyParams accepts any conforming object
describe('VerifyParams', () => {
  it('accepts an object with expectedHash and transactionHash', () => {
    const params: VerifyParams = {
      expectedHash: 'hash_expected',
      transactionHash: 'tx_hash',
    };
    expect(params.expectedHash).toBe('hash_expected');
    expect(params.transactionHash).toBe('tx_hash');
  });
});

// Feature: anchor-verify-types, Property 5: VerifyResult accepts minimal and fully-populated objects
describe('VerifyResult', () => {
  it('accepts a minimal object with only isValid', () => {
    const result: VerifyResult = { isValid: true };
    expect(result.isValid).toBe(true);
    expect(result.timestamp).toBeUndefined();
    expect(result.ledger).toBeUndefined();
    expect(result.confirmations).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  it('accepts a fully-populated object with all optional fields', () => {
    const ts = new Date('2024-06-01T12:00:00Z');
    const result: VerifyResult = {
      isValid: false,
      timestamp: ts,
      ledger: 100,
      confirmations: 5,
      reason: 'hash mismatch',
    };
    expect(result.isValid).toBe(false);
    expect(result.timestamp).toBe(ts);
    expect(result.ledger).toBe(100);
    expect(result.confirmations).toBe(5);
    expect(result.reason).toBe('hash mismatch');
  });
});
