import { BASE_RESERVE_XLM } from '../utils/constants';

function formatXlm(amount: number): string {
  // Keep at most 7 decimals (Stellar XLM precision) and strip trailing zeros.
  return amount.toFixed(7).replace(/\.?0+$/, '');
}

/**
 * Calculate the minimum XLM balance required for an account.
 *
 * Formula: BASE_RESERVE × (2 + numSubentries)
 * Where: numSubentries = numSigners + numOffers + numTrustlines
 *
 * @returns Minimum balance as an XLM string (e.g. "2.5", "1").
 */
export function getMinimumReserve(
  numSigners: number,
  numOffers: number,
  numTrustlines: number,
): string {
  const numSubentries = numSigners + numOffers + numTrustlines;
  const reserve = BASE_RESERVE_XLM * (2 + numSubentries);
  return formatXlm(reserve);
}

