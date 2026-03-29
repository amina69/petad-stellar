import { Memo } from '@stellar/stellar-sdk';
import { decodeMemo } from '../../../src/transactions/builder';

describe('decodeMemo', () => {
  it('decodes MEMO_NONE to null', () => {
    const result = decodeMemo(Memo.none());
    expect(result.type).toBe('MEMO_NONE');
    expect(result.value).toBeNull();
  });

  it('decodes MEMO_TEXT to original string', () => {
    const result = decodeMemo(Memo.text('hello world'));
    expect(result.type).toBe('MEMO_TEXT');
    expect(result.value).toBe('hello world');
  });

  it('decodes MEMO_TEXT with empty string', () => {
    const result = decodeMemo(Memo.text(''));
    expect(result.type).toBe('MEMO_TEXT');
    expect(result.value).toBe('');
  });

  it('decodes MEMO_ID to numeric string', () => {
    const result = decodeMemo(Memo.id('12345'));
    expect(result.type).toBe('MEMO_ID');
    expect(result.value).toBe('12345');
  });

  it('decodes MEMO_HASH to hex string', () => {
    const hashBuffer = Buffer.alloc(32, 0xab);
    const result = decodeMemo(Memo.hash(hashBuffer));
    expect(result.type).toBe('MEMO_HASH');
    expect(result.value).toBe('ab'.repeat(32));
  });

  it('decodes MEMO_HASH of all zeros', () => {
    const hashBuffer = Buffer.alloc(32, 0);
    const result = decodeMemo(Memo.hash(hashBuffer));
    expect(result.type).toBe('MEMO_HASH');
    expect(result.value).toBe('00'.repeat(32));
  });

  it('is exported from the public index', async () => {
    const mod = await import('../../../src/index');
    expect(mod.decodeMemo).toBeDefined();
  });
});
