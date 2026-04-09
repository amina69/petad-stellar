export const SDK_VERSION = '0.1.0';

// 1. Main class
export { StellarSDK } from './sdk';
export { StellarSDK as default } from './sdk';

// 2. Error classes
export {
  SdkError,
  ValidationError,
  AccountNotFoundError,
  EscrowNotFoundError,
  InsufficientBalanceError,
  HorizonSubmitError,
  TransactionTimeoutError,
  MonitorTimeoutError,
  FriendbotError,
  ConditionMismatchError,
} from './utils/errors';

// 3. Escrow types (canonical source for Signer + Thresholds)
export type {
  CreateEscrowParams,
  Signer,
  Thresholds,
  EscrowAccount,
  Distribution,
  ReleaseParams,
  ReleasedPayment,
  ReleaseResult,
  Percentage,
  LockFundsParams,
  LockResult,
} from './types/escrow';
export { EscrowStatus, asPercentage } from './types/escrow';

// 4. Network types (Signer + Thresholds excluded to avoid conflict)
export type { SDKConfig, KeypairResult, AccountInfo, BalanceInfo } from './types/network';

// 5. Transaction types
export type { SubmitResult, TransactionStatus, BuildParams, Operation } from './types/transaction';

// 6. Standalone functions
export { createEscrowAccount, encodeMemo, decodeMemo, lockCustodyFunds, anchorTrustHash, verifyEventHash } from './escrow';
export { buildMultisigTransaction } from './transactions';
export { getMinimumReserve, generateKeypair } from './accounts';
