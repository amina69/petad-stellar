import * as StellarSdk from '@stellar/stellar-sdk';
import { Config } from './config.js';
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
export declare class StellarService {
    private server;
    private config;
    constructor(config?: Config);
    createAccount(): Promise<AccountResult>;
    submitTransaction(transaction: StellarSdk.Transaction): Promise<TransactionResult>;
    getTransactionStatus(hash: string): Promise<TransactionResult>;
    anchorTrustHash(hash: string): Promise<TrustHashResult>;
    buildPaymentTransaction(sourceSecret: string, destinationPublicKey: string, amount: string, asset?: StellarSdk.Asset): Promise<StellarSdk.Transaction>;
    getServer(): StellarSdk.Horizon.Server;
    getConfig(): Config;
}
//# sourceMappingURL=stellar-service.d.ts.map