import * as StellarSdk from '@stellar/stellar-sdk';
import { Config } from '../config.js';
import { StellarService } from '../stellar-service.js';
import { NetworkGuard } from '../guards/network.guard.js';

export interface FundingTxParams {
  sourceSecret: string;
  destinationPublicKey: string;
  amount: string;
  escrowId: string;
  asset?: StellarSdk.Asset;
}

export interface FundingTxResult {
  txHash: string;
  xdr: string;
  transaction: StellarSdk.Transaction;
}

export interface TxSubmissionResult {
  hash: string;
  status: string;
  successful: boolean;
}

export class FundingService {
  private stellarService: StellarService;
  private config: Config;
  private networkGuard: NetworkGuard;

  constructor(config?: Config, networkGuard?: NetworkGuard) {
    this.config = config || Config.getInstance();
    this.networkGuard = networkGuard || NetworkGuard.withPublicConsent(this.config);
    this.stellarService = new StellarService(this.config, this.networkGuard);
  }

  /**
   * Builds a deterministic funding transaction with payment operation and memo
   * 
   * @param params Funding transaction parameters
   * @returns Transaction hash, XDR, and transaction object (not submitted)
   */
  public async buildFundingTx(params: FundingTxParams): Promise<FundingTxResult> {
    try {
      const {
        sourceSecret,
        destinationPublicKey,
        amount,
        escrowId,
        asset = StellarSdk.Asset.native()
      } = params;

      // Validate inputs
      this.validateFundingParams(params);

      // Create source keypair and load account
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourceAccount = await this.stellarService.getServer().loadAccount(sourceKeypair.publicKey());

      // Build transaction with payment operation and memo
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.config.getNetworkPassphrase(),
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationPublicKey,
            asset: asset,
            amount: amount,
          })
        )
        .addMemo(StellarSdk.Memo.text(escrowId))
        .setTimeout(30)
        .build();

      // Sign transaction with source secret
      transaction.sign(sourceKeypair);

      // Generate transaction hash
      const txHash = transaction.hash().toString('hex');

      // Convert to XDR
      const xdr = transaction.toEnvelope().toXDR('base64');

      return {
        txHash,
        xdr,
        transaction
      };

    } catch (error) {
      throw new Error(`Failed to build funding transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submits a signed transaction to the Stellar network
   * 
   * @param transaction Signed Stellar transaction
   * @returns Submission result with hash and status
   */
  public async submitTx(transaction: StellarSdk.Transaction): Promise<TxSubmissionResult> {
    try {
      // Validate network before submission
      this.networkGuard.validateTransactionSubmission();
      
      const result = await this.stellarService.getServer().submitTransaction(transaction);
      
      return {
        hash: result.hash,
        status: result.successful ? 'success' : 'failed',
        successful: result.successful,
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const horizonError = error as any;
        const result = horizonError.response?.data;
        throw new Error(`Transaction failed: ${result?.extras?.result_codes?.transaction || horizonError.message || 'Unknown error'}`);
      }
      throw new Error(`Failed to submit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submits a transaction from XDR string
   * 
   * @param xdr Transaction XDR string
   * @returns Submission result with hash and status
   */
  public async submitTxFromXDR(xdr: string): Promise<TxSubmissionResult> {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, this.config.getNetworkPassphrase()) as StellarSdk.Transaction;
      return await this.submitTx(transaction);
    } catch (error) {
      throw new Error(`Failed to submit transaction from XDR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates funding transaction parameters
   */
  private validateFundingParams(params: FundingTxParams): void {
    const { sourceSecret, destinationPublicKey, amount, escrowId } = params;

    // Validate source secret
    try {
      StellarSdk.Keypair.fromSecret(sourceSecret);
    } catch (error) {
      throw new Error('Invalid source secret key');
    }

    // Validate destination public key
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(destinationPublicKey);
    } catch (error) {
      throw new Error('Invalid destination public key');
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Amount must be a positive number');
    }

    // Validate escrowId
    if (!escrowId || escrowId.trim().length === 0) {
      throw new Error('Escrow ID cannot be empty');
    }

    if (escrowId.length > 28) {
      throw new Error('Escrow ID too long (max 28 characters for text memo)');
    }
  }

  /**
   * Creates a deterministic funding transaction for escrow accounts
   * 
   * @param sourceSecret Owner account secret (dev only)
   * @param escrowPublicKey Escrow account public key
   * @param escrowId Unique escrow identifier
   * @param amount Funding amount (defaults to 2 XLM)
   * @returns Funding transaction result
   */
  public async buildEscrowFundingTx(
    sourceSecret: string,
    escrowPublicKey: string,
    escrowId: string,
    amount: string = '2.0'
  ): Promise<FundingTxResult> {
    return this.buildFundingTx({
      sourceSecret,
      destinationPublicKey: escrowPublicKey,
      amount,
      escrowId,
      asset: StellarSdk.Asset.native()
    });
  }

  /**
   * Gets transaction status from Horizon
   * 
   * @param txHash Transaction hash
   * @returns Transaction status and details
   */
  public async getTxStatus(txHash: string): Promise<TxSubmissionResult> {
    try {
      const transaction = await this.stellarService.getServer().transactions().transaction(txHash).call();
      
      return {
        hash: transaction.hash,
        status: transaction.successful ? 'success' : 'failed',
        successful: transaction.successful,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error(`Transaction not found: ${txHash}`);
      }
      throw new Error(`Failed to get transaction status: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Validates a signed transaction without submitting
   * 
   * @param xdr Transaction XDR string
   * @returns Validation result with transaction details
   */
  public validateSignedTx(xdr: string): { valid: boolean; transaction?: StellarSdk.Transaction; error?: string } {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, this.config.getNetworkPassphrase()) as StellarSdk.Transaction;
      
      // Check if transaction is signed
      if (!transaction.signatures || transaction.signatures.length === 0) {
        return { valid: false, error: 'Transaction is not signed' };
      }

      // Validate transaction structure
      const operations = transaction.operations;
      if (!operations || operations.length === 0) {
        return { valid: false, error: 'Transaction has no operations' };
      }

      return { valid: true, transaction };
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Invalid transaction XDR' 
      };
    }
  }
}
