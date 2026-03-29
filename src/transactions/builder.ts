import { Memo, MemoType } from '@stellar/stellar-sdk';

export type DecodedMemo =
  | { type: 'MEMO_NONE'; value: null }
  | { type: 'MEMO_TEXT'; value: string }
  | { type: 'MEMO_ID'; value: string }
  | { type: 'MEMO_HASH'; value: string }
  | { type: 'MEMO_RETURN'; value: string };

/**
 * decodeMemo
 *
 * Decodes a Stellar Memo object back to its original value where possible.
 *
 * - MEMO_NONE   → null
 * - MEMO_TEXT   → original string
 * - MEMO_ID     → numeric value as string
 * - MEMO_HASH   → hex digest string (cannot be reversed — returned as-is)
 * - MEMO_RETURN → hex digest string (cannot be reversed — returned as-is)
 *
 * @param memo - A Stellar SDK Memo object
 * @returns DecodedMemo object with type and value
 *
 * @example
 * decodeMemo(Memo.none())
 * // { type: 'MEMO_NONE', value: null }
 *
 * decodeMemo(Memo.text('hello'))
 * // { type: 'MEMO_TEXT', value: 'hello' }
 *
 * decodeMemo(Memo.id('12345'))
 * // { type: 'MEMO_ID', value: '12345' }
 *
 * decodeMemo(Memo.hash(Buffer.alloc(32)))
 * // { type: 'MEMO_HASH', value: '0000...0000' }
 */
export function decodeMemo(memo: Memo): DecodedMemo {
  switch (memo.type as MemoType) {
    case 'none':
      return { type: 'MEMO_NONE', value: null };

    case 'text':
      return { type: 'MEMO_TEXT', value: memo.value as string };

    case 'id':
      return { type: 'MEMO_ID', value: String(memo.value) };

    case 'hash': {
      const hashValue = memo.value as Buffer;
      return {
        type: 'MEMO_HASH',
        value: Buffer.isBuffer(hashValue)
          ? hashValue.toString('hex')
          : String(hashValue),
      };
    }

    case 'return': {
      const returnValue = memo.value as Buffer;
      return {
        type: 'MEMO_RETURN',
        value: Buffer.isBuffer(returnValue)
          ? returnValue.toString('hex')
          : String(returnValue),
      };
    }

    default:
      return { type: 'MEMO_NONE', value: null };
  }
}