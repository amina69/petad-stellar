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
import { isValidPublicKey, isValidAmount, isValidSecretKey } from '../utils/validation';

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

export interface HandleDisputeParams extends DisputeParams {
  masterSecretKey: string;
}

interface HorizonSignerLike {
  key?: string;
  publicKey?: string;
  ed25519PublicKey?: string;
  weight: number;
}

interface HorizonThresholdsLike {
  low?: number;
  medium?: number;
  high?: number;
  low_threshold?: number;
  med_threshold?: number;
  high_threshold?: number;
}

interface HorizonAccountLike {
  sequence?: string;
  sequenceNumber?: string;
  signers?: HorizonSignerLike[];
  thresholds?: HorizonThresholdsLike;
  low_threshold?: number;
  med_threshold?: number;
  high_threshold?: number;
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

function getSequence(account: Account | HorizonAccountLike): string {
  const loaded = account as HorizonAccountLike;

  if (typeof loaded.sequence === 'string' && loaded.sequence.length > 0) {
    return loaded.sequence;
  }

  if (typeof loaded.sequenceNumber === 'string' && loaded.sequenceNumber.length > 0) {
    return loaded.sequenceNumber;
  }

  throw new Error('Unable to determine account sequence from Horizon response');
}

function getSignerPublicKey(signer: HorizonSignerLike): string | undefined {
  return signer.publicKey ?? signer.key ?? signer.ed25519PublicKey;
}

function pickNumber(...values: Array<unknown>): number {
  for (const value of values) {
    if (typeof value === 'number') {
      return value;
    }
  }

  return 0;
}

function getAccountSigners(account: Account | HorizonAccountLike): Signer[] {
  const loaded = account as HorizonAccountLike;
  if (!Array.isArray(loaded.signers)) return [];

  return loaded.signers
    .map((signer): Signer | null => {
      const publicKey = getSignerPublicKey(signer);
      const weight = Number(signer.weight);

      if (!publicKey || !Number.isFinite(weight)) {
        return null;
      }

      return {
        publicKey,
        weight,
      };
    })
    .filter((signer): signer is Signer => signer !== null);
}

function getAccountThresholds(account: Account | HorizonAccountLike): Thresholds {
  const loaded = account as HorizonAccountLike;
  const fromNested = loaded.thresholds ?? {};

  return {
    low: pickNumber(fromNested.low, fromNested.low_threshold, loaded.low_threshold),
    medium: pickNumber(fromNested.medium, fromNested.med_threshold, loaded.med_threshold),
    high: pickNumber(fromNested.high, fromNested.high_threshold, loaded.high_threshold),
  };
}

function isPlatformOnlyConfig(account: Account | HorizonAccountLike, platformPublicKey: string): boolean {
  const thresholds = getAccountThresholds(account);
  const activeSigners = getAccountSigners(account).filter(signer => signer.weight > 0);

  if (activeSigners.length !== 1) return false;
  if (activeSigners[0].publicKey !== platformPublicKey) return false;
  if (activeSigners[0].weight !== 3) return false;

  return thresholds.low === 0 && thresholds.medium === 2 && thresholds.high === 2;
}

export async function handleDispute(
  params: HandleDisputeParams,
  horizonServer: {
    loadAccount: (publicKey: string) => Promise<Account | HorizonAccountLike>;
    submitTransaction: (tx: Transaction) => Promise<{ hash: string }>;
  },
  networkPassphrase: string = Networks.TESTNET,
): Promise<DisputeResult> {
  const { escrowAccountId, masterSecretKey } = params;

  if (!isValidPublicKey(escrowAccountId)) {
    throw new ValidationError('escrowAccountId', 'Invalid escrow account ID');
  }

  if (!isValidSecretKey(masterSecretKey)) {
    throw new ValidationError('masterSecretKey', 'Invalid master secret key');
  }

  let platformKeypair: Keypair;
  try {
    platformKeypair = Keypair.fromSecret(masterSecretKey);
  } catch {
    throw new ValidationError('masterSecretKey', 'Invalid master secret key');
  }

  const platformPublicKey = platformKeypair.publicKey();
  const currentConfig = await horizonServer.loadAccount(escrowAccountId);
  const currentSigners = getAccountSigners(currentConfig);
  const sourceAccount =
    currentConfig instanceof Account
      ? currentConfig
      : new Account(escrowAccountId, getSequence(currentConfig));

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  });

  currentSigners
    .filter(signer => signer.publicKey !== platformPublicKey && signer.weight > 0)
    .forEach(signer => {
      txBuilder.addOperation(
        Operation.setOptions({
          source: escrowAccountId,
          signer: {
            ed25519PublicKey: signer.publicKey,
            weight: 0,
          },
        }),
      );
    });

  txBuilder
    .addOperation(
      Operation.setOptions({
        source: escrowAccountId,
        signer: {
          ed25519PublicKey: platformPublicKey,
          weight: 3,
        },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowAccountId,
        masterWeight: 0,
        lowThreshold: 0,
        medThreshold: 2,
        highThreshold: 2,
      }),
    );

  const tx = txBuilder.setTimeout(30).build();
  tx.sign(platformKeypair);

  const submitResult = await horizonServer.submitTransaction(tx);

  const updatedConfig = await horizonServer.loadAccount(escrowAccountId);
  if (!isPlatformOnlyConfig(updatedConfig, platformPublicKey)) {
    throw new Error('Dispute signer update verification failed');
  }

  return {
    accountId: escrowAccountId,
    pausedAt: new Date(),
    platformOnlyMode: true,
    txHash: submitResult.hash,
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