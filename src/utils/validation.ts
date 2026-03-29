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
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+(\.\d{1,7})?$/.test(amount);
}

function normalizePercentage(value: number): { scaledValue: bigint; scale: bigint } | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  const normalized = value.toString().toLowerCase();
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/);

  if (!match) return null;

  const integerPart = match[1];
  const fractionalPart = match[2] ?? '';
  const exponent = Number.parseInt(match[3] ?? '0', 10);
  const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
  const scalePower = fractionalPart.length - exponent;

  if (scalePower >= 0) {
    return {
      scaledValue: BigInt(digits),
      scale: 10n ** BigInt(scalePower),
    };
  }

  return {
    scaledValue: BigInt(digits) * 10n ** BigInt(-scalePower),
    scale: 1n,
  };
}

export function isValidDistribution(
  distribution: { recipient: string; percentage: number }[],
): boolean {
  if (!distribution || distribution.length === 0) return false;

  const normalizedEntries = distribution.map(entry => {
    if (!isValidPublicKey(entry.recipient)) return null;
    if (typeof entry.percentage !== 'number' || entry.percentage <= 0 || entry.percentage > 100) return null;

    return normalizePercentage(entry.percentage);
  });

  if (normalizedEntries.some(entry => entry === null)) return false;

  const scale = normalizedEntries.reduce<bigint>(
    (maxScale, entry) => ((entry as { scale: bigint }).scale > maxScale ? (entry as { scale: bigint }).scale : maxScale),
    1n,
  );

  const total = normalizedEntries.reduce(
    (sum, entry) => sum + ((entry as { scaledValue: bigint; scale: bigint }).scaledValue * (scale / (entry as { scale: bigint }).scale)),
    0n,
  );

  return total === 100n * scale;
}
