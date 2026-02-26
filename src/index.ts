import * as StellarSdk from '@stellar/stellar-sdk';
import { Config, EnvConfig } from './config.js';
import { StellarService, AccountResult, TransactionResult, TrustHashResult } from './stellar-service.js';

export interface PetAdChainConfig {
  envConfig?: Partial<EnvConfig>;
  useTestnet?: boolean;
}

export default class PetAdChain {
  private stellarService: StellarService;
  private config: Config;

  constructor(config?: PetAdChainConfig) {
    this.config = Config.getInstance(config?.envConfig);
    
    if (config?.useTestnet !== undefined) {
      this.config.setNetwork(config.useTestnet);
    }
    
    this.stellarService = new StellarService(this.config);
  }

  public async createAccount(): Promise<AccountResult> {
    return await this.stellarService.createAccount();
  }

  public async submitTransaction(transaction: StellarSdk.Transaction): Promise<TransactionResult> {
    return await this.stellarService.submitTransaction(transaction);
  }

  public async getTransactionStatus(hash: string): Promise<TransactionResult> {
    return await this.stellarService.getTransactionStatus(hash);
  }

  public async anchorTrustHash(hash: string, sourceSecret: string): Promise<TrustHashResult> {
    return await this.stellarService.anchorTrustHash(hash, sourceSecret);
  }

  public async sendPayment(
    sourceSecret: string,
    destinationPublicKey: string,
    amount: string,
    asset?: StellarSdk.Asset
  ): Promise<TransactionResult> {
    const transaction = await this.stellarService.buildPaymentTransaction(
      sourceSecret,
      destinationPublicKey,
      amount,
      asset
    );
    
    return await this.submitTransaction(transaction);
  }

  public getStellarService(): StellarService {
    return this.stellarService;
  }

  public getConfig(): Config {
    return this.config;
  }

  public switchToTestnet(): void {
    this.config.setNetwork(true);
    this.stellarService = new StellarService(this.config);
  }

  public switchToMainnet(): void {
    this.config.setNetwork(false);
    this.stellarService = new StellarService(this.config);
  }

  public isTestnet(): boolean {
    return this.config.isTestnet();
  }
}

export * from './config.js';
export * from './stellar-service.js';
export * from './services/escrow.service.js';
export * from './services/funding.service.js';
export * from './services/transaction-status.service.js';
export * from './contracts/escrow.contract.js';
