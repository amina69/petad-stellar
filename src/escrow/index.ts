import {
  Keypair,
  Memo,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Account,
  Transaction,
} from '@stellar/stellar-sdk';

import {
  CreateEscrowParams,
  DisputeParams,
  DisputeResult,
  EscrowAccount,
  EscrowStatus,
  ReleaseParams,
  ReleaseResult,
  Signer,
  Thresholds,
} from '../types/escrow';
import { getMinimumReserve } from '../accounts';
import { SdkError, ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';

import crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LockCustodyFundsParams {
  custodianPublicKey: string;
  ownerPublicKey: string;
  platformPublicKey: string;
  sourceKeypair: Keypair;
  depositAmount: string;
  durationDays: number;
}

export interface LockResult {
  unlockDate: Date;
  conditionsHash: string;
  escrowPublicKey: string;
  transactionHash: string;
}

export interface EscrowHorizonClient {
  loadAccount: (publicKey: string) => Promise<Account | { sequence: string }>;
  submitTransaction: (tx: Transaction) => Promise<{ hash: string }>;
}

export interface EscrowAccountManager {
  create: (args: {
    publicKey: string;
    startingBalance: string;
  }) => Promise<{ accountId: string; transactionHash: string }>;
  getBalance: (publicKey: string) => Promise<string>;
}

export interface EscrowTransactionManager {
  releaseFunds: (
    params: ReleaseParams,
    context: {
      horizonClient: EscrowHorizonClient;
      masterSecretKey: string;
    },
  ) => Promise<ReleaseResult>;
  handleDispute: (
    params: DisputeParams,
    context: {
      horizonClient: EscrowHorizonClient;
      masterSecretKey: string;
    },
  ) => Promise<DisputeResult>;
  getStatus: (
    escrowAccountId: string,
    context: {
      horizonClient: EscrowHorizonClient;
    },
  ) => Promise<EscrowStatus>;
}

export interface EscrowManagerDependencies {
  horizonClient: EscrowHorizonClient;
  accountManager: EscrowAccountManager;
  transactionManager: EscrowTransactionManager;
  masterSecretKey: string;
}

const MS_PER_DAY = 86_400_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hashData(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

export function memoFromHash(hash: string): string {
  return hash.slice(0, 28);
}

// ─── calculateStartingBalance ─────────────────────────────────────────────────

export function calculateStartingBalance(depositAmount: string): string {
  if (!isValidAmount(depositAmount)) {
    throw new ValidationError(
      'depositAmount',
      `Invalid deposit amount: ${depositAmount}`,
    );
  }

  const minimumReserve = parseFloat(getMinimumReserve(3, 0, 0));
  const deposit = parseFloat(depositAmount);
  const totalBalance = minimumReserve + deposit;

  return totalBalance.toFixed(7).replace(/\.?0+$/, '');
}

// ─── createEscrowAccount ──────────────────────────────────────────────────────

export async function createEscrowAccount(
  params: CreateEscrowParams,
  accountManager: {
    create: (args: { publicKey: string; startingBalance: string }) => Promise<{ accountId: string; transactionHash: string }>;
    getBalance: (publicKey: string) => Promise<string>;
  },
): Promise<EscrowAccount> {
  if (!isValidPublicKey(params.adopterPublicKey)) {
    throw new ValidationError('adopterPublicKey', 'Invalid public key');
  }

  if (!isValidPublicKey(params.ownerPublicKey)) {
    throw new ValidationError('ownerPublicKey', 'Invalid public key');
  }

  if (!isValidAmount(params.depositAmount)) {
    throw new ValidationError('depositAmount', 'Invalid amount');
  }

  const escrowKeypair = Keypair.random();
  const startingBalance = calculateStartingBalance(params.depositAmount);

  const result = await accountManager.create({
    publicKey: escrowKeypair.publicKey(),
    startingBalance,
  });

  const signers: Signer[] = [
    { publicKey: escrowKeypair.publicKey(), weight: 1 },
    { publicKey: params.adopterPublicKey, weight: 1 },
    { publicKey: params.ownerPublicKey, weight: 1 },
  ];

  const thresholds: Thresholds = {
    low: 1,
    medium: 2,
    high: 2,
  };

  return {
    accountId: result.accountId,
    transactionHash: result.transactionHash,
    signers,
    thresholds,
    unlockDate: params.unlockDate,
  };
}

// ─── lockCustodyFunds ─────────────────────────────────────────────────────────

export async function lockCustodyFunds(
  params: LockCustodyFundsParams,
  horizonServer: {
    loadAccount: (publicKey: string) => Promise<Account | { sequence: string }>;
    submitTransaction: (tx: Transaction) => Promise<{ hash: string }>;
  },
  networkPassphrase: string = Networks.TESTNET,
): Promise<LockResult> {
  const {
    custodianPublicKey,
    ownerPublicKey,
    platformPublicKey,
    sourceKeypair,
    depositAmount,
    durationDays,
  } = params;

  // VALIDATION
  if (!isValidPublicKey(custodianPublicKey)) {
    throw new ValidationError('custodianPublicKey', 'Invalid public key');
  }
  if (!isValidPublicKey(ownerPublicKey)) {
    throw new ValidationError('ownerPublicKey', 'Invalid public key');
  }
  if (!isValidPublicKey(platformPublicKey)) {
    throw new ValidationError('platformPublicKey', 'Invalid public key');
  }
  if (!isValidAmount(depositAmount)) {
    throw new ValidationError('depositAmount', 'Invalid deposit amount');
  }
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new ValidationError('durationDays', 'Invalid durationDays');
  }

  const conditionsHash = hashData({
    noViolations: true,
    petReturned: true,
  });

  const unlockDate = new Date(Date.now() + durationDays * MS_PER_DAY);

  const escrowKeypair = Keypair.random();

  // ✅ FIX: ensure Account instance
  const loaded = await horizonServer.loadAccount(sourceKeypair.publicKey());

  const sourceAccount =
    loaded instanceof Account
      ? loaded
      : new Account(sourceKeypair.publicKey(), loaded.sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.createAccount({
        destination: escrowKeypair.publicKey(),
        startingBalance: depositAmount,
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: { ed25519PublicKey: custodianPublicKey, weight: 1 },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: { ed25519PublicKey: ownerPublicKey, weight: 1 },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: { ed25519PublicKey: platformPublicKey, weight: 1 },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        masterWeight: 0,
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2,
      }),
    )
    .addMemo(Memo.text(memoFromHash(conditionsHash)))
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair, escrowKeypair);

  const result = await horizonServer.submitTransaction(tx);

  return {
    unlockDate,
    conditionsHash,
    escrowPublicKey: escrowKeypair.publicKey(),
    transactionHash: result.hash,
  };
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