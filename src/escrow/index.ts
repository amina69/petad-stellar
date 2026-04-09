import { createHash } from 'crypto';

import { CreateEscrowParams } from '../types/escrow';

export interface EscrowMemoData {
  adoptionId: string;
  petId: string;
}

export interface EscrowMemoText {
  type: 'MEMO_TEXT';
  value: string;
}

export interface EscrowMemoHash {
  type: 'MEMO_HASH';
  value: Buffer;
}

export type EscrowMemo = EscrowMemoText | EscrowMemoHash;

const MEMO_TEXT_LIMIT_BYTES = 28;
const memoHashLookup = new Map<string, string>();

function serializeMemoData(data: EscrowMemoData): string {
  return JSON.stringify({
    adoptionId: data.adoptionId,
    petId: data.petId,
  });
}

function getMemoHashLookupKey(hashValue: Buffer): string {
  return hashValue.toString('hex');
}

function deserializeMemoData(serialized: string): EscrowMemoData {
  return JSON.parse(serialized) as EscrowMemoData;
}

export function encodeMemo(data: EscrowMemoData): EscrowMemo {
  const serialized = serializeMemoData(data);
  const base64Encoded = Buffer.from(serialized, 'utf8').toString('base64');

  if (Buffer.byteLength(base64Encoded, 'utf8') <= MEMO_TEXT_LIMIT_BYTES) {
    return {
      type: 'MEMO_TEXT',
      value: base64Encoded,
    };
  }

  const hashValue = createHash('sha256').update(serialized, 'utf8').digest();

  memoHashLookup.set(getMemoHashLookupKey(hashValue), serialized);

  return {
    type: 'MEMO_HASH',
    value: hashValue,
  };
}

export function decodeMemo(memo: EscrowMemo): EscrowMemoData {
  if (memo.type === 'MEMO_TEXT') {
    const serialized = Buffer.from(memo.value, 'base64').toString('utf8');
    return deserializeMemoData(serialized);
  }

  const serialized = memoHashLookup.get(getMemoHashLookupKey(memo.value));

  if (!serialized) {
    throw new Error('Unable to decode MEMO_HASH without a matching encoded payload.');
  }

  return deserializeMemoData(serialized);
}

export function createEscrowAccount(params?: CreateEscrowParams): { memo?: EscrowMemo } {
  if (!params?.metadata) {
    return {};
  }

  return {
    memo: encodeMemo(params.metadata),
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