import { Horizon } from '@stellar/stellar-sdk';
import { TransactionManager, TransactionManagerConfig } from './transactions';
import { DEFAULT_MAX_FEE, DEFAULT_TRANSACTION_TIMEOUT } from './utils/constants';

/**
 * Configuration options for the StellarSDK
 */
export interface StellarSDKConfig {
  /** Horizon client instance for network communication */
  horizonClient: Horizon.Server;
  /** Maximum fee per operation in stroops (default: 10000) */
  maxFee?: number;
  /** Transaction timeout in seconds (default: 180) */
  transactionTimeout?: number;
}

/**
 * Main StellarSDK class providing high-level blockchain operations
 */
export class StellarSDK {
  /** Transaction manager for building, signing, and submitting transactions */
  public readonly transactions: TransactionManager;

  /**
   * Creates a new StellarSDK instance
   * @param config - Configuration options
   */
  constructor(config: StellarSDKConfig) {
    const transactionConfig: TransactionManagerConfig = {
      horizonClient: config.horizonClient,
      maxFee: config.maxFee ?? DEFAULT_MAX_FEE,
      transactionTimeout: config.transactionTimeout ?? DEFAULT_TRANSACTION_TIMEOUT
    };

    this.transactions = new TransactionManager(transactionConfig);
  }
}
