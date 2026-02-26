export interface EnvConfig {
    horizonUrl: string;
    networkPassphrase: string;
    masterSecret?: string;
}
export declare class Config {
    private static instance;
    private config;
    private constructor();
    static getInstance(envConfig?: Partial<EnvConfig>): Config;
    getHorizonUrl(): string;
    getNetworkPassphrase(): string;
    getMasterSecret(): string | undefined;
    isTestnet(): boolean;
    setNetwork(testnet: boolean): void;
}
//# sourceMappingURL=config.d.ts.map