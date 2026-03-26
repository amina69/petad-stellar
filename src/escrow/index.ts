import { Keypair } from '@stellar/stellar-sdk';
import type { KeypairResult } from '../types/network';

export function createEscrowAccount(): KeypairResult {
  const keypair = Keypair.random();

  // secretKey must not be logged or stored — used once for initial funding only
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown {
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown {
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown {
  return undefined;
}
