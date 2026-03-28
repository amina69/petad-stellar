import { HorizonClient, HorizonNotFoundError } from "./HorizonClient";
import { HorizonAccountResponse } from "./types";
import { EscrowStatus } from "./EscrowStatus";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Stellar base reserve: every account must hold at least 1 XLM.
 * Each sub-entry (signer, trustline, offer…) costs an additional 0.5 XLM.
 * An escrow account with 3 extra signers has 3 sub-entries → 1 + (3 × 0.5) = 2.5 XLM.
 *
 * We use a slightly generous ceiling (3 XLM) so a "just-opened" account with only
 * the base reserve is treated as SETTLED when its operational balance is gone.
 */
const MINIMUM_RESERVE_XLM = 3;

/**
 * Standard PetAd escrow signer count (buyer, seller, platform = 3 total).
 * Each carries weight 1; the master key is typically disabled (weight 0).
 */
const STANDARD_SIGNER_COUNT = 3;

/**
 * Weight threshold that flags the account as being in platform-only (disputed) mode.
 * When the platform reclaims full control it sets its own key to weight >= 2.
 */
const DISPUTE_SIGNER_WEIGHT_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Helper: extract native XLM balance
// ---------------------------------------------------------------------------

function getNativeBalance(account: HorizonAccountResponse): number {
  const native = account.balances.find((b) => b.asset_type === "native");
  if (!native) return 0;
  return parseFloat(native.balance);
}

// ---------------------------------------------------------------------------
// Derivation rules (evaluated in the order documented in EscrowStatus)
// ---------------------------------------------------------------------------

/**
 * FUNDED: balance >= depositAmount AND exactly STANDARD_SIGNER_COUNT signers
 * each with weight 1 (the happy-path, fully operational state).
 */
function isFunded(
  account: HorizonAccountResponse,
  depositAmount: number
): boolean {
  const balance = getNativeBalance(account);
  if (balance < depositAmount) return false;

  const activeSigners = account.signers.filter((s) => s.weight > 0);
  if (activeSigners.length !== STANDARD_SIGNER_COUNT) return false;

  return activeSigners.every((s) => s.weight === 1);
}

/**
 * DISPUTED: exactly one signer has weight >= DISPUTE_SIGNER_WEIGHT_THRESHOLD,
 * indicating the platform has taken exclusive control (dispute resolution mode).
 */
function isDisputed(account: HorizonAccountResponse): boolean {
  const highWeightSigners = account.signers.filter(
    (s) => s.weight >= DISPUTE_SIGNER_WEIGHT_THRESHOLD
  );
  return highWeightSigners.length === 1;
}

/**
 * SETTLING: balance is being drained — it is below the depositAmount threshold
 * but still above the minimum reserve, and the account does NOT match the
 * DISPUTED pattern (which would explain the non-standard signer state).
 */
function isSettling(
  account: HorizonAccountResponse,
  depositAmount: number
): boolean {
  const balance = getNativeBalance(account);
  return (
    balance < depositAmount &&
    balance > MINIMUM_RESERVE_XLM &&
    !isDisputed(account)
  );
}

/**
 * SETTLED: the account balance has fallen to or below the minimum reserve,
 * meaning all operational funds have been released.
 */
function isSettled(account: HorizonAccountResponse): boolean {
  return getNativeBalance(account) <= MINIMUM_RESERVE_XLM;
}

/**
 * CREATED: account exists on-chain but has not yet received the full deposit.
 */
function isCreated(
  account: HorizonAccountResponse,
  depositAmount: number
): boolean {
  return getNativeBalance(account) < depositAmount;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GetEscrowStatusOptions {
  /** Stellar account ID (G…) of the escrow account. */
  accountId: string;
  /**
   * Expected deposit amount in XLM that defines the FUNDED threshold.
   * Must be greater than MINIMUM_RESERVE_XLM.
   */
  depositAmount: number;
  /** Injected HorizonClient instance (defaults to testnet). */
  horizonClient?: HorizonClient;
}

/**
 * Derives the logical {@link EscrowStatus} for a PetAd escrow account
 * by inspecting live on-chain data from Horizon.
 *
 * Derivation order:
 *  1. NOT_FOUND  — account does not exist (Horizon 404)
 *  2. SETTLED    — balance ≤ minimum reserve
 *  3. FUNDED     — balance ≥ depositAmount AND standard 3-signer config
 *  4. DISPUTED   — single high-weight signer (platform-only mode)
 *  5. SETTLING   — balance draining, not yet at reserve floor
 *  6. CREATED    — account exists, balance < depositAmount (default / catch-all)
 */
export async function getEscrowStatus(
  options: GetEscrowStatusOptions
): Promise<EscrowStatus> {
  const { accountId, depositAmount, horizonClient = new HorizonClient() } =
    options;

  let account: HorizonAccountResponse;

  try {
    account = await horizonClient.fetchAccount(accountId);
  } catch (err) {
    if (err instanceof HorizonNotFoundError) {
      return EscrowStatus.NOT_FOUND;
    }
    throw err;
  }

  if (isSettled(account)) return EscrowStatus.SETTLED;
  if (isFunded(account, depositAmount)) return EscrowStatus.FUNDED;
  if (isDisputed(account)) return EscrowStatus.DISPUTED;
  if (isSettling(account, depositAmount)) return EscrowStatus.SETTLING;

  // Default: account exists, balance below threshold — must still be CREATED.
  return EscrowStatus.CREATED;
}