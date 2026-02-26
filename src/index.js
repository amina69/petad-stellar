import { Config } from './config.js';
import { StellarService } from './stellar-service.js';
export default class PetAdChain {
    stellarService;
    config;
    constructor(config) {
        this.config = Config.getInstance(config?.envConfig);
        if (config?.useTestnet !== undefined) {
            this.config.setNetwork(config.useTestnet);
        }
        this.stellarService = new StellarService(this.config);
    }
    async createAccount() {
        return await this.stellarService.createAccount();
    }
    async submitTransaction(transaction) {
        return await this.stellarService.submitTransaction(transaction);
    }
    async getTransactionStatus(hash) {
        return await this.stellarService.getTransactionStatus(hash);
    }
    async anchorTrustHash(hash) {
        return await this.stellarService.anchorTrustHash(hash);
    }
    async sendPayment(sourceSecret, destinationPublicKey, amount, asset) {
        const transaction = await this.stellarService.buildPaymentTransaction(sourceSecret, destinationPublicKey, amount, asset);
        return await this.submitTransaction(transaction);
    }
    getStellarService() {
        return this.stellarService;
    }
    getConfig() {
        return this.config;
    }
    switchToTestnet() {
        this.config.setNetwork(true);
        this.stellarService = new StellarService(this.config);
    }
    switchToMainnet() {
        this.config.setNetwork(false);
        this.stellarService = new StellarService(this.config);
    }
    isTestnet() {
        return this.config.isTestnet();
    }
}
export * from './config.js';
export * from './stellar-service.js';
export * from './contracts/escrow.contract.js';
//# sourceMappingURL=index.js.map