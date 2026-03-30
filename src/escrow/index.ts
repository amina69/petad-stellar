import {
  Account,
  Asset,
  Horizon,
  Keypair,
  Memo,
  Operation as StellarOperation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { Distribution, ReleaseParams, ReleaseResult } from '../types/escrow';
import { PaymentOp } from '../types/transaction';
import {
  DEFAULT_MAX_FEE,
  DEFAULT_TRANSACTION_TIMEOUT,
  MAINNET_HORIZON_URL,
  MAINNET_PASSPHRASE,
  TESTNET_HORIZON_URL,
  TESTNET_PASSPHRASE,
} from '../utils/constants';
import {
  EscrowNotFoundError,
  HorizonSubmitError,
  SdkError,
  ValidationError,
} from '../utils/errors';
import {
  isValidAmount,
  isValidDistribution,
  isValidPublicKey,
  isValidSecretKey,
} from '../utils/validation';

const STROOPS_PER_XLM = 10_000_000n;
const PERCENTAGE_SCALE = 10_000_000n;
const PERCENTAGE_DENOMINATOR = 100n * PERCENTAGE_SCALE;

type HorizonAccount = Account & {
  balances: Array<{ asset_type: string; balance: string }>;
  accountId(): string;
};
type SubmissionTransaction = Parameters<Horizon.Server['submitTransaction']>[0];

interface HorizonSubmission {
  successful: boolean;
  hash: string;
  ledger: number;
}

interface ReleaseServer {
  loadAccount(accountId: string): Promise<HorizonAccount>;
  submitTransaction(transaction: SubmissionTransaction): Promise<HorizonSubmission>;
}

interface ReleaseTransactionManager {
  submit(transaction: SubmissionTransaction): Promise<HorizonSubmission>;
}

interface ReleaseFundsDependencies {
  server?: ReleaseServer;
  transactionManager?: ReleaseTransactionManager;
  sleep?: (ms: number) => Promise<void>;
  horizonUrl?: string;
  networkPassphrase?: string;
  maxSubmitAttempts?: number;
}

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

function getNativeBalance(account: HorizonAccount): string {
  const nativeBalance = account.balances.find(balance => balance.asset_type === 'native');
  if (!nativeBalance) {
    throw new SdkError(
      `Native balance not found for account ${account.accountId()}`,
      'NATIVE_BALANCE_NOT_FOUND',
      false,
    );
  }

  return nativeBalance.balance;
}

function validateReleaseParams(params: ReleaseParams): void {
  if (!isValidPublicKey(params.escrowAccountId)) {
    throw new ValidationError('escrowAccountId', 'Invalid escrow account public key');
  }

  if (!isValidDistribution(params.distribution)) {
    throw new ValidationError(
      'distribution',
      'Distribution must contain valid recipients and total 100%',
    );
  }

  if (params.balance !== undefined && !isValidAmount(params.balance)) {
    throw new ValidationError('balance', 'Release balance must be a positive XLM amount');
  }

  if (params.masterSecretKey !== undefined && !isValidSecretKey(params.masterSecretKey)) {
    throw new ValidationError('masterSecretKey', 'Invalid master secret key');
  }

  if (params.sourceSecretKey !== undefined && !isValidSecretKey(params.sourceSecretKey)) {
    throw new ValidationError('sourceSecretKey', 'Invalid source secret key');
  }
}

function buildReleasePaymentOperations(
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

function paymentOperationToStellar(payment: PaymentOp) {
  return StellarOperation.payment({
    destination: payment.destination,
    asset: Asset.native(),
    amount: payment.amount,
  });
}

function getDefaultNetworkPassphrase(): string {
  if (process.env.STELLAR_NETWORK_PASSPHRASE) {
    return process.env.STELLAR_NETWORK_PASSPHRASE;
  }

  return process.env.STELLAR_NETWORK === 'public'
    ? MAINNET_PASSPHRASE
    : TESTNET_PASSPHRASE;
}

function getDefaultHorizonUrl(): string {
  if (process.env.STELLAR_HORIZON_URL) {
    return process.env.STELLAR_HORIZON_URL;
  }

  return process.env.STELLAR_NETWORK === 'public'
    ? MAINNET_HORIZON_URL
    : TESTNET_HORIZON_URL;
}

function getMasterSecretKey(params: ReleaseParams): string {
  const masterSecretKey =
    params.masterSecretKey ??
    params.sourceSecretKey ??
    process.env.MASTER_SECRET_KEY;
  if (!masterSecretKey) {
    throw new ValidationError(
      'masterSecretKey',
      'A master secret key is required to sign the release transaction',
    );
  }

  if (!isValidSecretKey(masterSecretKey)) {
    throw new ValidationError('masterSecretKey', 'Invalid master secret key');
  }

  return masterSecretKey;
}

function mapToSdkError(error: unknown, escrowAccountId: string): SdkError {
  if (error instanceof SdkError) {
    return error;
  }

  const maybeError = error as {
    response?: { status?: number; data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } };
    extras?: { result_codes?: { transaction?: string; operations?: string[] } };
    message?: string;
  };

  if (maybeError.response?.status === 404) {
    return new EscrowNotFoundError(escrowAccountId);
  }

  const resultCodes =
    maybeError.response?.data?.extras?.result_codes ??
    maybeError.extras?.result_codes;
  if (resultCodes?.transaction) {
    return new HorizonSubmitError(
      resultCodes.transaction,
      resultCodes.operations ?? [],
    );
  }

  return new SdkError(
    maybeError.message ?? 'Failed to release funds',
    'RELEASE_FUNDS_FAILED',
    false,
  );
}

async function loadEscrowAccount(
  server: Pick<ReleaseServer, 'loadAccount'>,
  escrowAccountId: string,
): Promise<HorizonAccount> {
  try {
    return await server.loadAccount(escrowAccountId);
  } catch (error) {
    throw mapToSdkError(error, escrowAccountId);
  }
}

async function submitReleaseTransaction(
  transactionManager: ReleaseTransactionManager,
  account: HorizonAccount,
  params: ReleaseParams,
  payments: PaymentOp[],
  networkPassphrase: string,
): Promise<ReleaseResult> {
  const masterSecretKey = getMasterSecretKey(params);
  const platformKeypair = Keypair.fromSecret(masterSecretKey);
  const fee = params.fee ?? process.env.MAX_FEE ?? String(DEFAULT_MAX_FEE);
  const timeoutSeconds = params.timeoutSeconds ?? DEFAULT_TRANSACTION_TIMEOUT;

  const builder = payments.reduce(
    (builder, payment) => builder.addOperation(paymentOperationToStellar(payment)),
    new TransactionBuilder(account, {
      fee,
      networkPassphrase,
    }),
  );

  if (params.memo) {
    builder.addMemo(Memo.text(params.memo));
  }

  const transaction = builder.setTimeout(timeoutSeconds).build();

  transaction.sign(platformKeypair);

  try {
    const submission = await transactionManager.submit(transaction);
    return {
      successful: submission.successful,
      txHash: submission.hash,
      ledger: submission.ledger,
      payments: payments.map(payment => ({
        recipient: payment.destination,
        amount: payment.amount,
      })),
    };
  } catch (error) {
    throw mapToSdkError(error, params.escrowAccountId);
  }
}

/**
 * Validates release inputs, builds payment operations from the requested
 * distribution, signs the transaction, and submits it to Horizon.
 *
 * The release amount is taken from `params.balance` when provided; otherwise
 * the current native XLM balance is loaded from Horizon for the escrow account.
 * Distribution math is performed in stroops using integer arithmetic so the
 * final payments preserve Stellar's 7-decimal precision and sum exactly to the
 * requested release amount.
 *
 * Retry behavior is limited to retryable `SdkError`s such as transient Horizon
 * submission failures. Non-retryable failures are rethrown immediately.
 *
 * @param params Release request containing the escrow account, recipients,
 * optional explicit release amount, and signing secret.
 * @param dependencies Optional test or runtime overrides for Horizon access,
 * passphrase selection, and retry behavior.
 * @returns A `ReleaseResult` describing the submitted transaction and the
 * recipient payments included in it.
 * @throws {ValidationError} If the account, balance, distribution, or secret is invalid.
 * @throws {EscrowNotFoundError} If the escrow account cannot be loaded from Horizon.
 * @throws {HorizonSubmitError} If Horizon rejects the submitted transaction.
 * @throws {SdkError} For any other release failure that cannot be mapped more specifically.
 */
export async function releaseFunds(
  params: ReleaseParams,
  dependencies: ReleaseFundsDependencies = {},
): Promise<ReleaseResult> {
  validateReleaseParams(params);

  const server =
    dependencies.server ??
    new Horizon.Server(dependencies.horizonUrl ?? getDefaultHorizonUrl());
  const networkPassphrase =
    dependencies.networkPassphrase ?? getDefaultNetworkPassphrase();
  const transactionManager =
    dependencies.transactionManager ?? {
      submit: (transaction: SubmissionTransaction) =>
        server.submitTransaction(transaction),
    };
  const maxSubmitAttempts = dependencies.maxSubmitAttempts ?? 2;
  const sleep = dependencies.sleep ?? (async () => undefined);

  let lastError: SdkError | undefined;

  for (let attempt = 1; attempt <= maxSubmitAttempts; attempt += 1) {
    try {
      const account = await loadEscrowAccount(server, params.escrowAccountId);
      const releaseBalance = params.balance ?? getNativeBalance(account);
      const payments = buildReleasePaymentOperations(
        releaseBalance,
        params.distribution,
      );

      return await submitReleaseTransaction(
        transactionManager,
        account,
        { ...params, balance: releaseBalance },
        payments,
        networkPassphrase,
      );
    } catch (error) {
      const sdkError = mapToSdkError(error, params.escrowAccountId);
      lastError = sdkError;

      if (!sdkError.retryable || attempt === maxSubmitAttempts) {
        throw sdkError;
      }

      await sleep(0);
    }
  }

  throw lastError ?? new SdkError('Failed to release funds', 'RELEASE_FUNDS_FAILED', false);
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