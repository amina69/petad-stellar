import { encodeMemo } from '../../../src/transactions';

describe('encodeMemo', () => {
  it('encodes short string as MEMO_TEXT', () => {
    const memo = encodeMemo('hello');
    expect(memo).toEqual({ type: 'MEMO_TEXT', value: 'hello' });
  });

  it('throws for string longer than 28 bytes', () => {
    const long = 'a'.repeat(29);
    expect(() => encodeMemo(long)).toThrow();
  });

  it('encodes small object as base64 MEMO_TEXT', () => {
    const obj = { a: 1 };
    const memo = encodeMemo(obj);
    expect(memo.type).toBe('MEMO_TEXT');
    expect(typeof (memo as any).value).toBe('string');
    expect((memo as any).value.length).toBeGreaterThan(0);
  });

  it('hashes large object to MEMO_HASH', () => {
    const obj = { data: 'x'.repeat(200) };
    const memo = encodeMemo(obj);
    expect(memo.type).toBe('MEMO_HASH');
    expect(Buffer.isBuffer((memo as any).value)).toBe(true);
    expect(((memo as any).value as Buffer).length).toBe(32);
  });
});
