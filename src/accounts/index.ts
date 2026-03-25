import { AccountInfo } from '../types/network';
import { SubmitResult } from '../types/transaction';
import {
  configureMultisigAccount,
  createAccount,
  CreateAccountOptions,
  fundTestnetAccount,
  generateAccount,
  HorizonClient,
  MergeAccountOptions,
  mergeAccount,
  StellarNetwork,
  verifyAccount,
  ConfigureMultisigOptions,
} from './operations';

export interface AccountManagerConfig {
  horizonClient: HorizonClient;
  masterSecretKey: string;
  network: StellarNetwork;
}

/**
 * Account management API backed by an injected Horizon client.
 */
export class AccountManager {
  constructor(
    private readonly config: AccountManagerConfig,
  ) {}

  /**
   * Generates a fresh Stellar keypair.
   */
  public generate() {
    return generateAccount();
  }

  /**
   * Creates a new Stellar account funded by the configured master account.
   * @param options Account creation parameters.
   */
  public create(options: CreateAccountOptions): Promise<SubmitResult> {
    return createAccount({
      horizonClient: this.config.horizonClient,
      masterSecretKey: this.config.masterSecretKey,
      network: this.config.network,
      options,
    });
  }

  /**
   * Verifies that an account exists and returns its current on-chain details.
   * @param accountId Stellar public key to verify.
   */
  public verify(accountId: string): Promise<AccountInfo> {
    return verifyAccount({
      horizonClient: this.config.horizonClient,
      accountId,
    });
  }

  /**
   * Configures multisig signer weights and thresholds for an account.
   * @param options Multisig signer and threshold settings.
   */
  public configureMultisig(options: ConfigureMultisigOptions): Promise<SubmitResult> {
    return configureMultisigAccount({
      horizonClient: this.config.horizonClient,
      network: this.config.network,
      options,
    });
  }

  /**
   * Merges a source account into a destination account.
   * @param options Source signer secret and merge destination.
   */
  public merge(options: MergeAccountOptions): Promise<SubmitResult> {
    return mergeAccount({
      horizonClient: this.config.horizonClient,
      network: this.config.network,
      options,
    });
  }

  /**
   * Funds an account on Stellar testnet through Friendbot.
   * @param publicKey Stellar public key to fund.
   */
  public fundTestnet(publicKey: string): Promise<void> {
    return fundTestnetAccount({
      horizonClient: this.config.horizonClient,
      publicKey,
    });
  }
}

export type {
  ConfigureMultisigOptions,
  CreateAccountOptions,
  HorizonClient,
  MergeAccountOptions,
  StellarNetwork,
} from './operations';
