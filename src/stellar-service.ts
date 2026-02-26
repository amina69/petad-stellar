import * as StellarSdk from '@stellar/stellar-sdk';
import { Config } from './config.js';
import { NetworkGuard } from './guards/network.guard.js';

export interface AccountResult {
  publicKey: string;
  secretKey: string;
}

export interface TransactionResult {
  hash: string;
  status: string;
  successful: boolean;
}

export interface TrustHashResult {
  hash: string;
  verified: boolean;
  timestamp?: Date;
}

export class StellarService {
  private server: StellarSdk.Horizon.Server;
  private config: Config;
  private networkGuard: NetworkGuard;

  constructor(config?: Config, networkGuard?: NetworkGuard) {
    this.config = config || Config.getInstance();
    this.server = new StellarSdk.Horizon.Server(this.config.getHorizonUrl());
    this.networkGuard = networkGuard || NetworkGuard.withPublicConsent(this.config);
  }

  public async createAccount(): Promise<AccountResult> {
    try {
      const pair = StellarSdk.Keypair.random();
      
      const friendbotUrl = `${this.config.getHorizonUrl()}/friendbot`;
      const response = await fetch(friendbotUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `addr=${pair.publicKey()}`,
      });

      if (!response.ok) {
        throw new Error(`Failed to fund account: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        publicKey: pair.publicKey(),
        secretKey: pair.secret(),
      };
    } catch (error) {
      throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async submitTransaction(transaction: StellarSdk.Transaction): Promise<TransactionResult> {
    try {
      // Validate network before submission
      this.networkGuard.validateTransactionSubmission();
      
      const result = await this.server.submitTransaction(transaction);
      
      return {
        hash: result.hash,
        status: result.successful ? 'success' : 'failed',
        successful: result.successful,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const horizonError = error as any;
        const result = horizonError.response?.data;
        throw new Error(`Transaction failed: ${result?.extras?.result_codes?.transaction || horizonError.message || 'Unknown error'}`);
      }
      throw new Error(`Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async getTransactionStatus(hash: string): Promise<TransactionResult> {
    try {
      const transaction = await this.server.transactions().transaction(hash).call();
      
      return {
        hash: transaction.hash,
        status: transaction.successful ? 'success' : 'failed',
        successful: transaction.successful,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error && (error as any).response?.status === 404) {
        throw new Error(`Transaction not found: ${hash}`);
      }
      throw new Error(`Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async anchorTrustHash(hash: string, sourceSecret: string): Promise<TrustHashResult> {
    if (hash.length > 28) {
      throw new Error('Hash exceeds 28 bytes limit for memo text');
    }

    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
    const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.config.getNetworkPassphrase(),
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: sourceKeypair.publicKey(),
          asset: StellarSdk.Asset.native(),
          amount: '0.00001',
        })
      )
      .addMemo(StellarSdk.Memo.text(hash))
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    
    const result = await this.server.submitTransaction(transaction);
    
    return {
      hash: result.hash,
      verified: result.successful,
      timestamp: new Date(),
    };
  }

  public async buildPaymentTransaction(
    sourceSecret: string,
    destinationPublicKey: string,
    amount: string,
    asset: StellarSdk.Asset = StellarSdk.Asset.native()
  ): Promise<StellarSdk.Transaction> {
    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
      
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.config.getNetworkPassphrase(),
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationPublicKey,
            asset: asset,
            amount: amount,
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(sourceKeypair);
      
      return transaction;
    } catch (error) {
      throw new Error(`Failed to build payment transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }

  public getConfig(): Config {
    return this.config;
  }

  public getNetworkGuard(): NetworkGuard {
    return this.networkGuard;
  }

  public getNetworkInfo() {
    return this.networkGuard.getNetworkInfo();
  }
}
