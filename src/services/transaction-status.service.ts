import * as StellarSdk from '@stellar/stellar-sdk';
import { Config } from '../config.js';

export interface TransactionStatusResult {
  confirmed: boolean;
  ledger?: number;
  timestamp?: string;
  hash: string;
  successful?: boolean;
  error?: string;
}

export interface PollingOptions {
  maxAttempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

export class TransactionStatusChecker {
  private server: StellarSdk.Horizon.Server;
  private config: Config;
  private readonly DEFAULT_MAX_ATTEMPTS = 30;
  private readonly DEFAULT_INTERVAL_MS = 2000;
  private readonly DEFAULT_TIMEOUT_MS = 60000;

  constructor(config?: Config) {
    this.config = config || Config.getInstance();
    this.server = new StellarSdk.Horizon.Server(this.config.getHorizonUrl());
  }

  /**
   * Gets transaction details by hash with retry logic for Horizon downtime
   */
  public async getTransactionByHash(
    txHash: string,
    retries: number = 3
  ): Promise<TransactionStatusResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const transaction = await this.server
          .transactions()
          .transaction(txHash)
          .call();

        return {
          confirmed: true,
          ledger: transaction.ledger_attr,
          timestamp: transaction.created_at,
          hash: transaction.hash,
          successful: transaction.successful,
        };
      } catch (error) {
        lastError = error as Error;

        // Handle 404 - transaction not found (not yet confirmed)
        if (this.isNotFoundError(error)) {
          return {
            confirmed: false,
            hash: txHash,
            error: 'Transaction not found on ledger',
          };
        }

        // Handle Horizon downtime or network errors
        if (this.isNetworkError(error)) {
          if (attempt < retries) {
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            await this.sleep(backoffMs);
            continue;
          }
        }

        // Other errors - throw immediately
        throw new Error(
          `Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // All retries exhausted
    throw new Error(
      `Horizon unavailable after ${retries} attempts: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Polls for transaction confirmation with configurable retry logic
   */
  public async pollForConfirmation(
    txHash: string,
    options: PollingOptions = {}
  ): Promise<TransactionStatusResult> {
    const maxAttempts = options.maxAttempts || this.DEFAULT_MAX_ATTEMPTS;
    const intervalMs = options.intervalMs || this.DEFAULT_INTERVAL_MS;
    const timeoutMs = options.timeoutMs || this.DEFAULT_TIMEOUT_MS;

    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Transaction confirmation timeout after ${timeoutMs}ms`
        );
      }

      try {
        const result = await this.getTransactionByHash(txHash, 2);

        if (result.confirmed) {
          return result;
        }

        // Not confirmed yet, wait before next attempt
        if (attempt < maxAttempts) {
          await this.sleep(intervalMs);
        }
      } catch (error) {
        // If Horizon is down, continue polling
        if (this.isHorizonDownError(error)) {
          if (attempt < maxAttempts) {
            await this.sleep(intervalMs);
            continue;
          }
        }

        // Other errors - throw
        throw error;
      }
    }

    return {
      confirmed: false,
      hash: txHash,
      error: `Transaction not confirmed after ${maxAttempts} attempts`,
    };
  }

  /**
   * Verifies transaction is included in a ledger
   */
  public async verifyLedgerInclusion(txHash: string): Promise<boolean> {
    try {
      const result = await this.getTransactionByHash(txHash);
      return result.confirmed && result.ledger !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Submits transaction and waits for confirmation
   */
  public async submitAndWaitForConfirmation(
    transaction: StellarSdk.Transaction,
    options: PollingOptions = {}
  ): Promise<TransactionStatusResult> {
    try {
      // Submit transaction
      const submitResult = await this.server.submitTransaction(transaction);
      const txHash = submitResult.hash;

      // If submission was successful, verify ledger inclusion
      if (submitResult.successful) {
        return await this.pollForConfirmation(txHash, options);
      }

      return {
        confirmed: false,
        hash: txHash,
        successful: false,
        error: 'Transaction submission failed',
      };
    } catch (error) {
      throw new Error(
        `Failed to submit and confirm transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Checks if error is a 404 Not Found error
   */
  private isNotFoundError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'response' in error &&
      (error as any).response?.status === 404
    );
  }

  /**
   * Checks if error is a network/connection error
   */
  private isNetworkError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const networkErrorPatterns = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'network',
      'timeout',
    ];

    return networkErrorPatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Checks if error indicates Horizon is down
   */
  private isHorizonDownError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    return (
      error.message.includes('Horizon unavailable') ||
      this.isNetworkError(error)
    );
  }

  /**
   * Sleep utility for polling delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets the Horizon server instance
   */
  public getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }
}
