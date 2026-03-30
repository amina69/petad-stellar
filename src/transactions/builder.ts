import crypto from 'crypto';

export type Memo =
  | { type: 'MEMO_TEXT'; value: string }
  | { type: 'MEMO_HASH'; value: Buffer };

export function encodeMemo(input: string | Record<string, unknown>): Memo {
  if (typeof input === 'string') {
    const bytes = Buffer.byteLength(input, 'utf8');
    if (bytes <= 28) return { type: 'MEMO_TEXT', value: input };
    throw new Error('Memo text exceeds 28 bytes');
  }

  const json = JSON.stringify(input);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  if (Buffer.byteLength(b64, 'utf8') <= 28) {
    return { type: 'MEMO_TEXT', value: b64 };
  }

  const hash = crypto.createHash('sha256').update(b64, 'utf8').digest();
  return { type: 'MEMO_HASH', value: hash };
}
