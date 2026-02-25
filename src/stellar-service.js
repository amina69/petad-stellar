import * as StellarSdk from '@stellar/stellar-sdk';
import { Config } from './config.js';
export class StellarService {
    server;
    config;
    constructor(config) {
        this.config = config || Config.getInstance();
        this.server = new StellarSdk.Horizon.Server(this.config.getHorizonUrl());
    }
    async createAccount() {
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
        }
        catch (error) {
            throw new Error(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async submitTransaction(transaction) {
        try {
            const result = await this.server.submitTransaction(transaction);
            return {
                hash: result.hash,
                status: result.successful ? 'success' : 'failed',
                successful: result.successful,
            };
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const horizonError = error;
                const result = horizonError.response?.data;
                throw new Error(`Transaction failed: ${result?.extras?.result_codes?.transaction || horizonError.message || 'Unknown error'}`);
            }
            throw new Error(`Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTransactionStatus(hash) {
        try {
            const transaction = await this.server.transactions().transaction(hash).call();
            return {
                hash: transaction.hash,
                status: transaction.successful ? 'success' : 'failed',
                successful: transaction.successful,
            };
        }
        catch (error) {
            if (error && typeof error === 'object' && 'response' in error && error.response?.status === 404) {
                throw new Error(`Transaction not found: ${hash}`);
            }
            throw new Error(`Failed to get transaction status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async anchorTrustHash(hash) {
        try {
            const transaction = await this.getTransactionStatus(hash);
            return {
                hash: hash,
                verified: transaction.successful,
                timestamp: new Date(),
            };
        }
        catch (error) {
            return {
                hash: hash,
                verified: false,
            };
        }
    }
    async buildPaymentTransaction(sourceSecret, destinationPublicKey, amount, asset = StellarSdk.Asset.native()) {
        try {
            const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
            const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());
            const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.config.getNetworkPassphrase(),
            })
                .addOperation(StellarSdk.Operation.payment({
                destination: destinationPublicKey,
                asset: asset,
                amount: amount,
            }))
                .setTimeout(30)
                .build();
            transaction.sign(sourceKeypair);
            return transaction;
        }
        catch (error) {
            throw new Error(`Failed to build payment transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getServer() {
        return this.server;
    }
    getConfig() {
        return this.config;
    }
}
//# sourceMappingURL=stellar-service.js.map