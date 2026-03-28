import { Horizon, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { SDKConfig, SubmittableTransaction } from './types/network';
import { SubmitResult } from './types/transaction';
import {
  ValidationError,
  HorizonSubmitError,
  InsufficientBalanceError,
  TransactionTimeoutError,
} from './utils/errors';

/**
 * Main SDK entry point for PetAd blockchain infrastructure.
 * Handles network connections and provides access to Stellar services.
 */
export class StellarSDK {
  public readonly horizon: Horizon.Server;
  private readonly config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = config;
    this.horizon = new Horizon.Server(config.horizonUrl);
  }

  /** Access the raw Horizon server instance */
  public get horizonClient(): Horizon.Server {
    return this.horizon;
  }

  /** Get the network passphrase for this instance */
  public get networkPassphrase(): string {
    return (
      this.config.networkPassphrase ||
      (this.config.network === 'public'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015')
    );
  }

  /**
   * Serialise a transaction to XDR string.
   */
  public transactionToXDR(tx: Transaction): string {
    return tx.toXDR();
  }

  /**
   * Deserialise an XDR string back to a Transaction object.
   */
  public transactionFromXDR(xdr: string): Transaction {
    if (!xdr || typeof xdr !== 'string' || xdr.trim().length === 0) {
      throw new ValidationError('xdr', 'Invalid XDR envelope');
    }

    try {
      return TransactionBuilder.fromXDR(xdr, this.networkPassphrase) as Transaction;
    } catch (error) {
      throw new ValidationError('xdr', 'Invalid XDR envelope');
    }
  }

  /**
   * Submit a signed transaction to the Stellar network and handle error cases.
   */
  public async submitTransaction(tx: Transaction): Promise<SubmitResult> {
    try {
      const result = await this.horizon.submitTransaction(tx as SubmittableTransaction);

      return {
        successful: true,
        hash: result.hash,
        ledger: result.ledger,
        resultXdr: result.result_xdr,
      };
    } catch (error: any) {
      // Handle 504 Gateway Timeout separately
      if (error.response?.status === 504) {
        throw new TransactionTimeoutError(tx.hash().toString('hex'));
      }

      const extras = error.response?.data?.extras;
      const resultCode = extras?.result_codes?.transaction;
      const opCodes = extras?.result_codes?.operations || [];

      if (!resultCode) {
        throw new HorizonSubmitError(error.message || 'Unknown submission error');
      }

      if (resultCode === 'tx_bad_seq') {
        throw new HorizonSubmitError('tx_bad_seq'); // retryable: true via constructor
      }

      if (resultCode === 'tx_bad_auth') {
        throw new HorizonSubmitError('tx_bad_auth'); // retryable: false via constructor
      }

      if (opCodes.includes('op_underfunded') || resultCode === 'tx_insufficient_balance') {
        throw new InsufficientBalanceError('unknown', 'unknown');
      }

      throw new HorizonSubmitError(resultCode, opCodes);
    }
  }
}
