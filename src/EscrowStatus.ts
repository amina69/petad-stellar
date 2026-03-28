/**
 * Logical status of a PetAd escrow account derived from on-chain state.
 *
 * Rules (evaluated in order):
 *  NOT_FOUND  – Horizon returned 404 for the account.
 *  CREATED    – Account exists but balance < depositAmount threshold.
 *  FUNDED     – Balance >= threshold AND standard 3-signer config is present.
 *  DISPUTED   – Exactly one signer holds weight >= 2 (platform-only mode).
 *  SETTLING   – Balance is being drained (balance < threshold but account still open
 *               and does NOT match the DISPUTED pattern).
 *  SETTLED    – Account has been merged (404 after it was previously seen) OR
 *               balance <= minimum Stellar reserve (1 XLM base + 0.5 per sub-entry).
 */
export enum EscrowStatus {
  NOT_FOUND = "NOT_FOUND",
  CREATED = "CREATED",
  FUNDED = "FUNDED",
  DISPUTED = "DISPUTED",
  SETTLING = "SETTLING",
  SETTLED = "SETTLED",
}