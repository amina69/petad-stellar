import Server from '@stellar/stellar-sdk';

import { MIN_ACCOUNT_BALANCE_XLM, TESTNET_HORIZON_URL } from '../utils/constants';
import { EscrowStatus } from '../types/escrow';
import type { Signer, Thresholds } from '../types/escrow';

function parseAmount(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Invalid amount: ${value}`);
  }
  return amount;
}

function getNativeBalance(balances: Array<{ asset_type: string; balance: string }>): number {
  const nativeBalance = balances.find((balance) => balance.asset_type === 'native')?.balance;
  const amount = Number(nativeBalance ?? '0');
  return Number.isFinite(amount) ? amount : 0;
}

function isPlatformOnlyMode(signers: Signer[]): boolean {
  const signersWithControl = signers.filter((signer) => signer.weight >= 2);
  return signersWithControl.length === 1;
}

function isStandardThreeSignerConfig(signers: Signer[], thresholds: Thresholds): boolean {
  const oneWeightSignerCount = signers.filter((signer) => signer.weight === 1).length;
  return oneWeightSignerCount >= 3 && thresholds.high === 2;
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const maybeResponse = (error as Record<string, unknown>).response;
    if (maybeResponse && typeof maybeResponse === 'object') {
      return (maybeResponse as Record<string, unknown>).status === 404;
    }

    return (error as Record<string, unknown>).status === 404;
  }
  return false;
}

export async function getEscrowStatus(
  escrowAccountId: string,
  depositAmount: string,
  horizonUrl = TESTNET_HORIZON_URL,
): Promise<EscrowStatus> {
  const server = new Server(horizonUrl);
  const depositThreshold = parseAmount(depositAmount);

  try {
    const account = await server.loadAccount(escrowAccountId) as {
      balances: Array<{ asset_type: string; balance: string }>;
      signers: Signer[];
      thresholds: Thresholds;
    };

    const nativeBalance = getNativeBalance(account.balances);
    if (nativeBalance <= MIN_ACCOUNT_BALANCE_XLM) {
      return EscrowStatus.SETTLED;
    }

    if (isPlatformOnlyMode(account.signers)) {
      return EscrowStatus.DISPUTED;
    }

    if (nativeBalance >= depositThreshold && isStandardThreeSignerConfig(account.signers, account.thresholds)) {
      return EscrowStatus.FUNDED;
    }

    if (nativeBalance < depositThreshold && isStandardThreeSignerConfig(account.signers, account.thresholds)) {
      return EscrowStatus.SETTLING;
    }

    return EscrowStatus.CREATED;
  } catch (error) {
    if (isNotFoundError(error)) {
      return EscrowStatus.NOT_FOUND;
    }
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEscrowAccount(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown { return undefined; }
