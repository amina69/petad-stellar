import * as StellarSdk from '@stellar/stellar-sdk';
import { Config, EnvConfig } from './config.js';
import { StellarService, AccountResult, TransactionResult, TrustHashResult } from './stellar-service.js';
export interface PetAdChainConfig {
    envConfig?: Partial<EnvConfig>;
    useTestnet?: boolean;
}
export default class PetAdChain {
    private stellarService;
    private config;
    constructor(config?: PetAdChainConfig);
    createAccount(): Promise<AccountResult>;
    submitTransaction(transaction: StellarSdk.Transaction): Promise<TransactionResult>;
    getTransactionStatus(hash: string): Promise<TransactionResult>;
    anchorTrustHash(hash: string): Promise<TrustHashResult>;
    sendPayment(sourceSecret: string, destinationPublicKey: string, amount: string, asset?: StellarSdk.Asset): Promise<TransactionResult>;
    getStellarService(): StellarService;
    getConfig(): Config;
    switchToTestnet(): void;
    switchToMainnet(): void;
    isTestnet(): boolean;
}
export * from './config.js';
export * from './stellar-service.js';
export * from './contracts/escrow.contract.js';
//# sourceMappingURL=index.d.ts.map