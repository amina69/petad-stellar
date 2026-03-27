import { createHash } from 'crypto';

import { CreateEscrowParams } from '../types/escrow';

export interface EscrowMemoData {
  adoptionId: string;
  petId: string;
}

export interface EscrowMemoText {
  type: 'MEMO_TEXT';
  value: string;
}

export interface EscrowMemoHash {
  type: 'MEMO_HASH';
  value: Buffer;
}

export type EscrowMemo = EscrowMemoText | EscrowMemoHash;

const MEMO_TEXT_LIMIT_BYTES = 28;
const memoHashLookup = new Map<string, EscrowMemoData>();

function serializeMemoData(data: EscrowMemoData): string {
  return JSON.stringify({
    adoptionId: data.adoptionId,
    petId: data.petId,
  });
}

function getMemoHashLookupKey(hashValue: Buffer): string {
  return hashValue.toString('hex');
}

export function encodeMemo(data: EscrowMemoData): EscrowMemo {
  const serialized = serializeMemoData(data);
  const base64Encoded = Buffer.from(serialized, 'utf8').toString('base64');

  if (Buffer.byteLength(base64Encoded, 'utf8') <= MEMO_TEXT_LIMIT_BYTES) {
    return {
      type: 'MEMO_TEXT',
      value: base64Encoded,
    };
  }

  const hashValue = createHash('sha256').update(serialized, 'utf8').digest();

  memoHashLookup.set(getMemoHashLookupKey(hashValue), data);

  return {
    type: 'MEMO_HASH',
    value: hashValue,
  };
}

export function decodeMemo(memo: EscrowMemo): EscrowMemoData {
  if (memo.type === 'MEMO_TEXT') {
    const serialized = Buffer.from(memo.value, 'base64').toString('utf8');
    return JSON.parse(serialized) as EscrowMemoData;
  }

  const decoded = memoHashLookup.get(getMemoHashLookupKey(memo.value));

  if (!decoded) {
    throw new Error('Unable to decode MEMO_HASH without a matching encoded payload.');
  }

  return decoded;
}

export function createEscrowAccount(params?: CreateEscrowParams): { memo?: EscrowMemo } {
  if (!params?.metadata) {
    return {};
  }

  return {
    memo: encodeMemo(params.metadata),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown { return undefined; }
