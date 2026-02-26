import { Config } from '../config.js';

export enum NetworkType {
  TESTNET = 'testnet',
  PUBLIC = 'public'
}

export interface NetworkGuardConfig {
  allowedNetwork?: NetworkType | undefined;
  requireExplicitConsent?: boolean;
  isDevelopment?: boolean;
}

export class NetworkGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkGuardError';
  }
}

export class NetworkGuard {
  private config: Config;
  private guardConfig: NetworkGuardConfig;

  constructor(config?: Config, guardConfig?: NetworkGuardConfig) {
    this.config = config || Config.getInstance();
    this.guardConfig = {
      allowedNetwork: NetworkType.TESTNET,
      requireExplicitConsent: true,
      isDevelopment: process.env.NODE_ENV !== 'production',
      ...guardConfig
    };
  }

  /**
   * Validates that the current network matches the allowed network
   * Throws NetworkGuardError if validation fails
   */
  public validateNetwork(): void {
    const currentNetwork = this.getCurrentNetwork();
    const { allowedNetwork, isDevelopment } = this.guardConfig;

    // In development, only allow testnet by default
    if (isDevelopment && currentNetwork === NetworkType.PUBLIC) {
      throw new NetworkGuardError(
        'NETWORK GUARD: Cannot submit transactions to PUBLIC network in development mode. ' +
        'Set NODE_ENV=production and ALLOW_PUBLIC_NETWORK=true to enable public network access.'
      );
    }

    // Check if current network matches allowed network
    if (allowedNetwork && currentNetwork !== allowedNetwork) {
      throw new NetworkGuardError(
        `NETWORK GUARD: Current network is ${currentNetwork.toUpperCase()} but only ${allowedNetwork.toUpperCase()} is allowed. ` +
        `Check your HORIZON_URL and NETWORK_PASSPHRASE configuration.`
      );
    }
  }

  /**
   * Validates network before transaction submission with explicit consent check
   */
  public validateTransactionSubmission(): void {
    this.validateNetwork();

    const currentNetwork = this.getCurrentNetwork();
    const { requireExplicitConsent } = this.guardConfig;

    // Require explicit consent for public network transactions
    if (requireExplicitConsent && currentNetwork === NetworkType.PUBLIC) {
      const allowPublic = process.env.ALLOW_PUBLIC_NETWORK === 'true';
      
      if (!allowPublic) {
        throw new NetworkGuardError(
          'NETWORK GUARD: Public network transaction blocked. ' +
          'Set ALLOW_PUBLIC_NETWORK=true environment variable to explicitly allow public network transactions.'
        );
      }
    }
  }

  /**
   * Gets the current network type based on configuration
   */
  public getCurrentNetwork(): NetworkType {
    return this.config.isTestnet() ? NetworkType.TESTNET : NetworkType.PUBLIC;
  }

  /**
   * Checks if current network is testnet
   */
  public isTestnet(): boolean {
    return this.getCurrentNetwork() === NetworkType.TESTNET;
  }

  /**
   * Checks if current network is public (mainnet)
   */
  public isPublic(): boolean {
    return this.getCurrentNetwork() === NetworkType.PUBLIC;
  }

  /**
   * Gets network information for logging
   */
  public getNetworkInfo(): {
    network: NetworkType;
    horizonUrl: string;
    networkPassphrase: string;
    isDevelopment: boolean;
  } {
    return {
      network: this.getCurrentNetwork(),
      horizonUrl: this.config.getHorizonUrl(),
      networkPassphrase: this.config.getNetworkPassphrase(),
      isDevelopment: this.guardConfig.isDevelopment || false
    };
  }

  /**
   * Creates a network guard with testnet-only restriction
   */
  public static testnetOnly(config?: Config): NetworkGuard {
    return new NetworkGuard(config, {
      allowedNetwork: NetworkType.TESTNET,
      requireExplicitConsent: true,
      isDevelopment: true
    });
  }

  /**
   * Creates a network guard that allows public network with explicit consent
   */
  public static withPublicConsent(config?: Config): NetworkGuard {
    return new NetworkGuard(config, {
      requireExplicitConsent: true,
      isDevelopment: process.env.NODE_ENV !== 'production'
    });
  }
}
