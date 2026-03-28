export interface SDKConfig {
  network: 'testnet' | 'public';
  horizonUrl: string;
  masterSecretKey: string;
  networkPassphrase?: string;
  transactionTimeout?: number;
  maxFee?: number;
}

export interface KeypairResult {
  publicKey: string;
  secretKey: string;
}

export interface Signer {
  publicKey: string;
  weight: number;
}

export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

export interface AccountInfo {
  accountId: string;
  balance: string;
  signers: Signer[];
  thresholds: Thresholds;
  sequenceNumber: string;
  exists: boolean;
}

export interface BalanceInfo {
  accountId: string;
  balance: string;
  lastModifiedLedger: number;
}

export interface AnchorParams {
  hash: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

export interface AnchorResult {
  txHash: string;
  ledger: number;
  verified: boolean;
  timestamp: Date;
}

export interface VerifyParams {
  expectedHash: string;
  transactionHash: string;
}

export interface VerifyResult {
  isValid: boolean;
  timestamp?: Date;
  ledger?: number;
  confirmations?: number;
  reason?: string;
}
