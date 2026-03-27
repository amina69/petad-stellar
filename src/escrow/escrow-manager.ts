import { SdkError, ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { EscrowStatus } from '../types/escrow';
import type {
  CreateEscrowParams,
  EscrowAccount,
  ReleaseParams,
  ReleaseResult,
  DisputeParams,
  DisputeResult,
} from '../types/escrow';
import type { BalanceInfo } from '../types/network';
import type { SubmitResult } from '../types/transaction';
import type { EscrowManagerDeps } from './types';

/**
 * Orchestrates escrow lifecycle operations using injected dependencies.
 * All Horizon interactions are delegated to the provided clients.
 */
export class EscrowManager {
  private readonly deps: EscrowManagerDeps;

  /**
   * @param deps - Injected dependencies for account, transaction, and Horizon operations.
   * @throws {ValidationError} If masterSecretKey is not provided.
   */
  constructor(deps: EscrowManagerDeps) {
    if (!deps.masterSecretKey) {
      throw new ValidationError('masterSecretKey', 'masterSecretKey is required');
    }
    this.deps = deps;
  }

  /**
   * Create a new escrow account on the Stellar network.
   * @param params - Escrow creation parameters.
   * @returns The created escrow account details.
   */
  async createAccount(params: CreateEscrowParams): Promise<EscrowAccount> {
    try {
      return await this.deps.accountManager.createEscrowAccount(params);
    } catch (err) {
      throw this.wrap('createAccount', err);
    }
  }

  /**
   * Lock funds into an escrow account.
   * @param escrowAccountId - Public key of the escrow account.
   * @param amount - XLM amount to lock.
   * @returns Transaction submission result.
   * @throws {ValidationError} If escrowAccountId or amount is invalid.
   */
  async lockFunds(escrowAccountId: string, amount: string): Promise<SubmitResult> {
    if (!isValidPublicKey(escrowAccountId)) {
      throw new ValidationError('escrowAccountId', 'Invalid escrow account ID');
    }
    if (!isValidAmount(amount)) {
      throw new ValidationError('amount', 'Invalid amount');
    }
    try {
      return await this.deps.transactionManager.lockFunds(
        escrowAccountId,
        amount,
        this.deps.masterSecretKey,
      );
    } catch (err) {
      throw this.wrap('lockFunds', err);
    }
  }

  /**
   * Release escrowed funds according to the provided distribution.
   * @param params - Release parameters including distribution.
   * @returns Release transaction result.
   */
  async releaseFunds(params: ReleaseParams): Promise<ReleaseResult> {
    try {
      return await this.deps.transactionManager.releaseFunds(params, this.deps.masterSecretKey);
    } catch (err) {
      throw this.wrap('releaseFunds', err);
    }
  }

  /**
   * Flag an escrow as disputed, restricting further operations.
   * @param params - Dispute parameters.
   * @returns Dispute result with freeze details.
   */
  async handleDispute(params: DisputeParams): Promise<DisputeResult> {
    try {
      return await this.deps.transactionManager.handleDispute(params, this.deps.masterSecretKey);
    } catch (err) {
      throw this.wrap('handleDispute', err);
    }
  }

  /**
   * Retrieve the native XLM balance of an escrow account.
   * @param escrowAccountId - Public key of the escrow account.
   * @returns Balance information.
   * @throws {ValidationError} If escrowAccountId is invalid.
   */
  async getBalance(escrowAccountId: string): Promise<BalanceInfo> {
    if (!isValidPublicKey(escrowAccountId)) {
      throw new ValidationError('escrowAccountId', 'Invalid escrow account ID');
    }
    try {
      return await this.deps.horizonClient.getBalance(escrowAccountId);
    } catch (err) {
      throw this.wrap('getBalance', err);
    }
  }

  /**
   * Determine the current status of an escrow account.
   * @param escrowAccountId - Public key of the escrow account.
   * @returns Current escrow status.
   * @throws {ValidationError} If escrowAccountId is invalid.
   */
  async getStatus(escrowAccountId: string): Promise<EscrowStatus> {
    if (!isValidPublicKey(escrowAccountId)) {
      throw new ValidationError('escrowAccountId', 'Invalid escrow account ID');
    }
    try {
      const info = await this.deps.horizonClient.getAccountInfo(escrowAccountId);
      if (!info.exists) return EscrowStatus.NOT_FOUND;
      const balance = parseFloat(info.balance);
      return balance > 0 ? EscrowStatus.FUNDED : EscrowStatus.CREATED;
    } catch (err) {
      throw this.wrap('getStatus', err);
    }
  }

  /** Wrap non-SDK errors with a consistent error code. */
  private wrap(method: string, err: unknown): SdkError {
    if (err instanceof SdkError) return err;
    const message = err instanceof Error ? err.message : String(err);
    return new SdkError(
      `EscrowManager.${method} failed: ${message}`,
      'ESCROW_MANAGER_ERROR',
    );
  }
}
