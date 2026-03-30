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

// ─── Placeholders ─────────────────────────────────────────────────────────────

export function anchorTrustHash(): undefined {
  return undefined;
}

export function verifyEventHash(): undefined {
  return undefined;
}

export class EscrowManager {
  private readonly horizonClient: EscrowHorizonClient;

  private readonly accountManager: EscrowAccountManager;

  private readonly transactionManager: EscrowTransactionManager;

  private readonly masterSecretKey: string;

  /**
   * Creates an escrow manager with injected dependencies.
   */
  constructor(dependencies: EscrowManagerDependencies) {
    this.horizonClient = dependencies.horizonClient;
    this.accountManager = dependencies.accountManager;
    this.transactionManager = dependencies.transactionManager;
    this.masterSecretKey = dependencies.masterSecretKey;
  }

  /**
   * Creates a new escrow account and configures signer thresholds.
   */
  async createAccount(params: CreateEscrowParams): Promise<EscrowAccount> {
    return this.executeWithErrorWrapping('createAccount', () =>
      createEscrowAccount(params, this.accountManager),
    );
  }

  /**
   * Locks custody funds in escrow.
   */
  async lockFunds(
    params: LockCustodyFundsParams,
    networkPassphrase: string = Networks.TESTNET,
  ): Promise<LockResult> {
    return this.executeWithErrorWrapping('lockFunds', () =>
      lockCustodyFunds(params, this.horizonClient, networkPassphrase),
    );
  }

  /**
   * Releases escrow funds using the configured transaction manager.
   */
  async releaseFunds(params: ReleaseParams): Promise<ReleaseResult> {
    return this.executeWithErrorWrapping('releaseFunds', () =>
      this.transactionManager.releaseFunds(params, {
        horizonClient: this.horizonClient,
        masterSecretKey: this.masterSecretKey,
      }),
    );
  }

  /**
   * Applies dispute handling flow for an escrow account.
   */
  async handleDispute(params: DisputeParams): Promise<DisputeResult> {
    return this.executeWithErrorWrapping('handleDispute', () =>
      this.transactionManager.handleDispute(params, {
        horizonClient: this.horizonClient,
        masterSecretKey: this.masterSecretKey,
      }),
    );
  }

  /**
   * Gets the XLM balance for an account.
   */
  async getBalance(publicKey: string): Promise<string> {
    return this.executeWithErrorWrapping('getBalance', () =>
      this.accountManager.getBalance(publicKey),
    );
  }

  /**
   * Retrieves the current escrow status.
   */
  async getStatus(escrowAccountId: string): Promise<EscrowStatus> {
    return this.executeWithErrorWrapping('getStatus', () =>
      this.transactionManager.getStatus(escrowAccountId, {
        horizonClient: this.horizonClient,
      }),
    );
  }

  private async executeWithErrorWrapping<T>(
    operation: string,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw this.wrapError(operation, error);
    }
  }

  private wrapError(operation: string, error: unknown): SdkError {
    if (error instanceof SdkError) {
      return error;
    }

    if (error instanceof Error) {
      return new SdkError(
        `EscrowManager.${operation} failed: ${error.message}`,
        'ESCROW_MANAGER_ERROR',
        false,
      );
    }

    return new SdkError(`EscrowManager.${operation} failed`, 'ESCROW_MANAGER_ERROR', false);
  }
}