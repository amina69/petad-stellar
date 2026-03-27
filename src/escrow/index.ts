import { Distribution } from '../types/escrow';
import { PaymentOp } from '../types/transaction';

const STROOPS_PER_XLM = 10_000_000n;
const PERCENTAGE_SCALE = 10_000_000n;
const PERCENTAGE_DENOMINATOR = 100n * PERCENTAGE_SCALE;

function amountToStroops(amount: string): bigint {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const normalizedFraction = `${fractionalPart}0000000`.slice(0, 7);

  return (
    BigInt(wholePart || '0') * STROOPS_PER_XLM +
    BigInt(normalizedFraction || '0')
  );
}

function stroopsToAmount(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const fraction = (stroops % STROOPS_PER_XLM).toString().padStart(7, '0');
  return `${whole.toString()}.${fraction}`;
}

function scalePercentage(percentage: number): bigint {
  return BigInt(percentage.toFixed(7).replace('.', ''));
}

export function releaseFunds(
  balance: string,
  distribution: Distribution[],
): PaymentOp[] {
  const totalStroops = amountToStroops(balance);

  const calculatedShares = distribution.map((entry, index) => {
    const numerator = totalStroops * scalePercentage(entry.percentage);
    return {
      index,
      recipient: entry.recipient,
      baseStroops: numerator / PERCENTAGE_DENOMINATOR,
      remainder: numerator % PERCENTAGE_DENOMINATOR,
    };
  });

  const allocatedStroops = calculatedShares.reduce(
    (sum, share) => sum + share.baseStroops,
    0n,
  );
  let remainingStroops = totalStroops - allocatedStroops;

  const bonusRecipients = [...calculatedShares].sort((left, right) => {
    if (left.remainder === right.remainder) {
      return left.index - right.index;
    }
    return left.remainder > right.remainder ? -1 : 1;
  });

  for (let i = 0; remainingStroops > 0n; i += 1) {
    bonusRecipients[i].baseStroops += 1n;
    remainingStroops -= 1n;
  }

  return calculatedShares.map(share => ({
    type: 'Payment',
    destination: share.recipient,
    asset: 'XLM',
    amount: stroopsToAmount(share.baseStroops),
  }));
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
