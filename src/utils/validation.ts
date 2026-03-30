import { StrKey } from '@stellar/stellar-sdk';

export function isValidPublicKey(key: string): boolean {
  return StrKey.isValidEd25519PublicKey(key);
}

export function isValidSecretKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return key.startsWith('S') && key.length === 56;
}

export function isValidAmount(amount: string): boolean {
  if (!amount || typeof amount !== 'string') return false;

  // Stellar amounts are plain decimal strings with up to 7 fractional digits.
  // This also rejects scientific notation (e.g. "1e5").
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) return false;

  const num = Number(amount);
  return Number.isFinite(num) && num > 0;
}

export function isValidDistribution(
  distribution: { recipient: string; percentage: number }[],
): boolean {
  if (!distribution || distribution.length === 0) return false;
  if (!distribution.every((d) => isValidPublicKey(d.recipient))) return false;
  const total = distribution.reduce((sum, d) => sum + d.percentage, 0);
  return Math.round(total) === 100;
}
