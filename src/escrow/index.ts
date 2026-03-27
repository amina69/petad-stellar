import { Horizon, NotFoundError } from '@stellar/stellar-sdk';

import { ReleaseParams } from '../types/escrow';
import { TESTNET_HORIZON_URL } from '../utils/constants';
import {
  EscrowNotFoundError,
  InsufficientBalanceError,
  ValidationError,
} from '../utils/errors';
import { isValidDistribution, isValidPublicKey } from '../utils/validation';

export interface ReleaseFundsValidationDeps {
  loadAccount?: (
    escrowAccountId: string,
  ) => Promise<Horizon.AccountResponse>;
}

function createDefaultLoadAccount(
): (escrowAccountId: string) => Promise<Horizon.AccountResponse> {
  const server = new Horizon.Server(TESTNET_HORIZON_URL);
  return (escrowAccountId: string) => server.loadAccount(escrowAccountId);
}

function getNativeBalance(account: Horizon.AccountResponse): string {
  const nativeBalance = account.balances.find(
    balance => balance.asset_type === 'native',
  );

  return nativeBalance?.balance ?? '0';
}

export async function validateReleaseFundsParams(
  { escrowAccountId, distribution }: ReleaseParams,
  deps: ReleaseFundsValidationDeps = {},
): Promise<Horizon.AccountResponse> {
  if (!isValidPublicKey(escrowAccountId)) {
    throw new ValidationError(
      'escrowAccountId',
      'Invalid escrow account public key',
    );
  }

  if (!isValidDistribution(distribution)) {
    throw new ValidationError(
      'distribution',
      'Invalid escrow distribution payload',
    );
  }

  const loadAccount = deps.loadAccount ?? createDefaultLoadAccount();

  let account: Horizon.AccountResponse;
  try {
    account = await loadAccount(escrowAccountId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new EscrowNotFoundError(escrowAccountId);
    }

    throw error;
  }

  const nativeBalance = getNativeBalance(account);
  if (Number(nativeBalance) <= 0) {
    throw new InsufficientBalanceError('greater than 0', nativeBalance);
  }

  return account;
}

export async function releaseFunds(
  params: ReleaseParams,
  deps: ReleaseFundsValidationDeps = {},
): Promise<Horizon.AccountResponse> {
  return validateReleaseFundsParams(params, deps);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createEscrowAccount(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown { return undefined; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown { return undefined; }
