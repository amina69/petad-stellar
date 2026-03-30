import { Server } from '@stellar/stellar-sdk';
import { TESTNET_HORIZON_URL } from '../utils/constants';
import { AccountNotFoundError } from '../utils/errors';

const cache = new Map<string, { sequence: string; ts: number }>();
const TTL = 5000; // 5 seconds

export async function fetchSequenceNumber(accountId: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(accountId);
  if (cached && now - cached.ts < TTL) return cached.sequence;

  const server = new Server(TESTNET_HORIZON_URL);
  try {
    const res: any = await server.accounts().accountId(accountId).call();
    const sequence = String(res.sequence);
    cache.set(accountId, { sequence, ts: now });
    return sequence;
  } catch (err: any) {
    if (err && err.response && err.response.status === 404) {
      throw new AccountNotFoundError(accountId);
    }
    throw err;
  }
}
