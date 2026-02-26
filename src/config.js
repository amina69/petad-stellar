export class Config {
    static instance;
    config;
    constructor(envConfig) {
        const horizonUrl = envConfig?.horizonUrl || process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
        const networkPassphrase = envConfig?.networkPassphrase || process.env.NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
        const masterSecret = envConfig?.masterSecret !== undefined ? envConfig.masterSecret : process.env.MASTER_SECRET;
        this.config = {
            horizonUrl,
            networkPassphrase,
            ...(masterSecret !== undefined && { masterSecret })
        };
    }
    static getInstance(envConfig) {
        if (!Config.instance) {
            Config.instance = new Config(envConfig);
        }
        return Config.instance;
    }
    getHorizonUrl() {
        return this.config.horizonUrl;
    }
    getNetworkPassphrase() {
        return this.config.networkPassphrase;
    }
    getMasterSecret() {
        return this.config.masterSecret;
    }
    isTestnet() {
        return this.config.networkPassphrase.includes('Test');
    }
    setNetwork(testnet) {
        if (testnet) {
            this.config.horizonUrl = 'https://horizon-testnet.stellar.org';
            this.config.networkPassphrase = 'Test SDF Network ; September 2015';
        }
        else {
            this.config.horizonUrl = 'https://horizon.stellar.org';
            this.config.networkPassphrase = 'Public Global Stellar Network ; September 2015';
        }
    }
}
//# sourceMappingURL=config.js.map