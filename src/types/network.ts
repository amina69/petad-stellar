export interface SDKConfig {
  network: 'testnet' | 'public';
  horizonUrl: string;
  masterSecretKey: string;
  networkPassphrase?: string;
  transactionTimeout?: number;
  maxFee?: number;
}

export interface KeypairResult {
  publicKey: string;
  secretKey: string;
}
