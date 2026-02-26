import * as StellarSdk from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { Config } from '../config.js';
import { StellarService } from '../stellar-service.js';

export interface EscrowAccountResult {
  publicKey: string;
  encryptedSecret: string;
  funded: boolean;
}

export interface AccountValidationResult {
  exists: boolean;
  balance: string;
  sequence: string;
}

export class EscrowService {
  private stellarService: StellarService;
  private config: Config;

  constructor(config?: Config) {
    this.config = config || Config.getInstance();
    this.stellarService = new StellarService(this.config);
  }

  /**
   * Creates a new escrow account with encryption
   */
  public async createEscrowAccount(encryptionKey?: string): Promise<EscrowAccountResult> {
    try {
      // Generate new Stellar keypair
      const keypair = StellarSdk.Keypair.random();
      const publicKey = keypair.publicKey();
      const secretKey = keypair.secret();

      // Encrypt the secret key
      const encryptedSecret = this.encryptSecret(secretKey, encryptionKey);

      // Fund the account with minimum XLM reserve
      const funded = await this.fundAccount(publicKey);

      return {
        publicKey,
        encryptedSecret,
        funded
      };
    } catch (error) {
      throw new Error(`Failed to create escrow account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts a Stellar secret key using AES-256-GCM
   */
  private encryptSecret(secret: string, key?: string): string {
    const encryptionKey = key || this.config.getMasterSecret();
    if (!encryptionKey) {
      throw new Error('No encryption key provided. Set MASTER_SECRET in environment or pass encryptionKey parameter.');
    }

    const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypts a Stellar secret key
   */
  public decryptSecret(encryptedSecret: string, key?: string): string {
    const encryptionKey = key || this.config.getMasterSecret();
    if (!encryptionKey) {
      throw new Error('No encryption key provided. Set MASTER_SECRET in environment or pass key parameter.');
    }

    const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
    const combined = Buffer.from(encryptedSecret, 'base64');
    
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Funds a new account with minimum XLM reserve using friendbot (testnet) or master account (mainnet)
   */
  private async fundAccount(publicKey: string): Promise<boolean> {
    try {
      if (this.config.isTestnet()) {
        // Use friendbot for testnet
        const friendbotUrl = `${this.config.getHorizonUrl()}/friendbot`;
        const response = await fetch(friendbotUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `addr=${publicKey}`,
        });

        if (!response.ok) {
          throw new Error(`Friendbot funding failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Account funded via friendbot:', result);
        return true;
      } else {
        // For mainnet, use master account to fund (requires MASTER_SECRET)
        const masterSecret = this.config.getMasterSecret();
        if (!masterSecret) {
          throw new Error('MASTER_SECRET required for mainnet account funding');
        }

        // Minimum reserve is 1 XLM + 0.5 XLM per entry, we'll send 2 XLM to be safe
        const transaction = await this.stellarService.buildPaymentTransaction(
          masterSecret,
          publicKey,
          '2.0'
        );

        const result = await this.stellarService.submitTransaction(transaction);
        return result.successful;
      }
    } catch (error) {
      console.error('Failed to fund account:', error);
      return false;
    }
  }

  /**
   * Validates if an account exists on the Stellar network
   */
  public async validateAccountExistence(publicKey: string): Promise<AccountValidationResult> {
    try {
      const server = this.stellarService.getServer();
      const account = await server.loadAccount(publicKey);
      
      const xlmBalance = account.balances
        .filter((balance: any) => balance.asset_type === 'native')
        .map((balance: any) => balance.balance)[0] || '0';

      return {
        exists: true,
        balance: xlmBalance,
        sequence: account.sequence
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return {
          exists: false,
          balance: '0',
          sequence: '0'
        };
      }
      throw new Error(`Failed to validate account: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Creates an escrow account and validates it was created successfully
   */
  public async createAndValidateEscrowAccount(encryptionKey?: string): Promise<EscrowAccountResult & AccountValidationResult> {
    const escrowAccount = await this.createEscrowAccount(encryptionKey);
    
    // Wait a moment for the funding to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const validation = await this.validateAccountExistence(escrowAccount.publicKey);
    
    if (!validation.exists) {
      throw new Error('Escrow account was created but funding failed - account not found on network');
    }

    return {
      ...escrowAccount,
      ...validation
    };
  }

  /**
   * Generates a deterministic encryption key from a seed
   */
  public static generateEncryptionKey(seed: string): string {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }
}
