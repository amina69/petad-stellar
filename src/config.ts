export interface EnvConfig {
	horizonUrl: string;
	networkPassphrase: string;
	masterSecret?: string | undefined;
	custodianPublicKey?: string | undefined;
}

export class Config {
	private static instance: Config;
	private config: EnvConfig;

	private constructor(envConfig?: Partial<EnvConfig>) {
		const horizonUrl =
			envConfig?.horizonUrl ||
			process.env.HORIZON_URL ||
			"https://horizon-testnet.stellar.org";
		const networkPassphrase =
			envConfig?.networkPassphrase ||
			process.env.NETWORK_PASSPHRASE ||
			"Test SDF Network ; September 2015";
		const masterSecret =
			envConfig?.masterSecret !== undefined
				? envConfig.masterSecret
				: process.env.MASTER_SECRET;
		const custodianPublicKey =
			envConfig?.custodianPublicKey || process.env.CUSTODIAN_PUBLIC_KEY;

		this.config = {
			horizonUrl,
			networkPassphrase,
			...(masterSecret !== undefined && { masterSecret }),
			...(custodianPublicKey !== undefined && { custodianPublicKey }),
		};
	}

	public static getInstance(envConfig?: Partial<EnvConfig>): Config {
		if (!Config.instance) {
			Config.instance = new Config(envConfig);
		}
		return Config.instance;
	}

	public getHorizonUrl(): string {
		return this.config.horizonUrl;
	}

	public getNetworkPassphrase(): string {
		return this.config.networkPassphrase;
	}

	public getMasterSecret(): string | undefined {
		return this.config.masterSecret;
	}

	public getCustodianPublicKey(): string | undefined {
		return this.config.custodianPublicKey;
	}

	public isTestnet(): boolean {
		return this.config.networkPassphrase.includes("Test");
	}

	public setNetwork(testnet: boolean): void {
		if (testnet) {
			this.config.horizonUrl = "https://horizon-testnet.stellar.org";
			this.config.networkPassphrase = "Test SDF Network ; September 2015";
		} else {
			this.config.horizonUrl = "https://horizon.stellar.org";
			this.config.networkPassphrase =
				"Public Global Stellar Network ; September 2015";
		}
	}
}
