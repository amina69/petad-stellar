import type { AccountInfo, BalanceInfo } from '../types/network';
import type {
  CreateEscrowParams,
  EscrowAccount,
  DisputeParams,
  DisputeResult,
  ReleaseParams,
  ReleaseResult,
} from '../types/escrow';
import type { SubmitResult } from '../types/transaction';

/** Abstraction over Horizon API for read-only account queries. */
export interface IHorizonClient {
  getBalance(accountId: string): Promise<BalanceInfo>;
  getAccountInfo(accountId: string): Promise<AccountInfo>;
}

/** Creates and configures Stellar escrow accounts. */
export interface IAccountManager {
  createEscrowAccount(params: CreateEscrowParams): Promise<EscrowAccount>;
}

/** Builds, signs, and submits escrow-related transactions. */
export interface ITransactionManager {
  lockFunds(escrowAccountId: string, amount: string, secretKey: string): Promise<SubmitResult>;
  releaseFunds(params: ReleaseParams, secretKey: string): Promise<ReleaseResult>;
  handleDispute(params: DisputeParams, secretKey: string): Promise<DisputeResult>;
}

/** Dependencies injected into the EscrowManager constructor. */
export interface EscrowManagerDeps {
  horizonClient: IHorizonClient;
  accountManager: IAccountManager;
  transactionManager: ITransactionManager;
  masterSecretKey: string;
}
