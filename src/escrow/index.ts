import { isValidPublicKey } from '../utils/validation';
import { ValidationError, EscrowNotFoundError } from '../utils/errors';
import { BalanceInfo } from '../types/network';

export async function getEscrowBalance(
  accountId: string,
  horizonUrl: string,
): Promise<BalanceInfo> {
  // Validate the account ID
  if (!isValidPublicKey(accountId)) {
    throw new ValidationError('accountId', 'Invalid public key format');
  }

  try {
    // Fetch account from Horizon
    const response = await fetch(`${horizonUrl}/accounts/${accountId}`);

    if (response.status === 404) {
      throw new EscrowNotFoundError(accountId);
    }

    if (!response.ok) {
      throw new Error(`Horizon error: ${response.statusText}`);
    }

    const account = await response.json() as {
      balances: Array<{ balance: string; asset_type: string }>;
      last_modified_ledger: number;
    };

    // Extract native (XLM) balance
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === 'native',
    );

    if (!nativeBalance) {
      // Account exists but has no XLM balance
      return {
        accountId,
        balance: '0',
        lastModifiedLedger: account.last_modified_ledger,
      };
    }

    return {
      accountId,
      balance: nativeBalance.balance,
      lastModifiedLedger: account.last_modified_ledger,
    };
  } catch (error) {
    if (error instanceof EscrowNotFoundError || error instanceof ValidationError) {
      throw error;
    }
    throw new Error(`Failed to fetch escrow balance: ${error instanceof Error ? error.message : String(error)}`);
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
