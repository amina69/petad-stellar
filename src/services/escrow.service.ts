import * as StellarSdk from "@stellar/stellar-sdk";
import { Config } from "../config.js";
import { StellarService } from "../stellar-service.js";
import { EncryptionUtils } from "../utils/encryption.utils.js";
import { NetworkGuard } from "../guards/network.guard.js";

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

export interface EscrowReleaseParams {
	escrowPublicKey: string;
	encryptedSecret: string;
	encryptionKey?: string;
	custodianPublicKey?: string;
	amount?: string;
}

export interface EscrowReleaseResult {
	txHash: string;
	successful: boolean;
	released: boolean;
}

export interface EscrowRefundParams {
	escrowPublicKey: string;
	encryptedSecret: string;
	encryptionKey?: string;
	ownerPublicKey: string;
	amount?: string;
}

export interface EscrowRefundResult {
	txHash: string;
	successful: boolean;
	refunded: boolean;
	idempotent?: boolean;
}

export class EscrowService {
	private stellarService: StellarService;
	private config: Config;
	private networkGuard: NetworkGuard;
	private releasedTransactions: Set<string> = new Set();
	private refundedTransactions: Set<string> = new Set();

	constructor(config?: Config, networkGuard?: NetworkGuard) {
		this.config = config || Config.getInstance();
		this.networkGuard = networkGuard || NetworkGuard.withPublicConsent(this.config);
		this.stellarService = new StellarService(this.config, this.networkGuard);
	}

	/**
	 * Creates a new escrow account with encryption
	 */
	public async createEscrowAccount(
		encryptionKey?: string,
	): Promise<EscrowAccountResult> {
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
				funded,
			};
		} catch (error) {
			throw new Error(
				`Failed to create escrow account: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Encrypts a Stellar secret key using AES-256-GCM
	 */
	private encryptSecret(secret: string, key?: string): string {
		const encryptionKey = key || this.config.getMasterSecret();
		if (!encryptionKey) {
			throw new Error(
				"Encryption key required. Set ENCRYPTION_KEY or MASTER_SECRET environment variable.",
			);
		}
		return EncryptionUtils.encryptSecret(secret, encryptionKey);
	}

	/**
	 * Decrypts a Stellar secret key
	 */
	public decryptSecret(encryptedSecret: string, key?: string): string {
		const encryptionKey = key || this.config.getMasterSecret();
		if (!encryptionKey) {
			throw new Error(
				"Encryption key required. Set ENCRYPTION_KEY or MASTER_SECRET environment variable.",
			);
		}
		return EncryptionUtils.decryptSecret(encryptedSecret, encryptionKey);
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
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: `addr=${publicKey}`,
				});

				if (!response.ok) {
					throw new Error(`Friendbot funding failed: ${response.statusText}`);
				}

				const result = await response.json();
				console.log("Account funded via friendbot:", result);
				return true;
			} else {
				// For mainnet, use master account to fund (requires MASTER_SECRET)
				const masterSecret = this.config.getMasterSecret();
				if (!masterSecret) {
					throw new Error("MASTER_SECRET required for mainnet account funding");
				}

				// Minimum reserve is 1 XLM + 0.5 XLM per entry, we'll send 2 XLM to be safe
				const transaction = await this.stellarService.buildPaymentTransaction(
					masterSecret,
					publicKey,
					"2.0",
				);

				const result = await this.stellarService.submitTransaction(transaction);
				return result.successful;
			}
		} catch (error) {
			console.error("Failed to fund account:", error);
			return false;
		}
	}

	/**
	 * Validates if an account exists on the Stellar network
	 */
	public async validateAccountExistence(
		publicKey: string,
	): Promise<AccountValidationResult> {
		try {
			const server = this.stellarService.getServer();
			const account = await server.loadAccount(publicKey);

			const xlmBalance =
				account.balances
					.filter((balance: any) => balance.asset_type === "native")
					.map((balance: any) => balance.balance)[0] || "0";

			return {
				exists: true,
				balance: xlmBalance,
				sequence: account.sequence,
			};
		} catch (error: any) {
			if (error.response?.status === 404) {
				return {
					exists: false,
					balance: "0",
					sequence: "0",
				};
			}
			throw new Error(
				`Failed to validate account: ${error.message || "Unknown error"}`,
			);
		}
	}

	/**
	 * Creates an escrow account and validates it was created successfully
	 */
	public async createAndValidateEscrowAccount(
		encryptionKey?: string,
	): Promise<EscrowAccountResult & AccountValidationResult> {
		const escrowAccount = await this.createEscrowAccount(encryptionKey);

		// Wait a moment for the funding to be processed
		await new Promise((resolve) => setTimeout(resolve, 2000));

		const validation = await this.validateAccountExistence(
			escrowAccount.publicKey,
		);

		if (!validation.exists) {
			throw new Error(
				"Escrow account was created but funding failed - account not found on network",
			);
		}

		return {
			...escrowAccount,
			...validation,
		};
	}

	/**
	 * Releases funds from escrow account to custodian
	 * Enforces single-release rule with idempotency check
	 */
	public async releaseEscrowFunds(
		params: EscrowReleaseParams,
	): Promise<EscrowReleaseResult> {
		try {
			const {
				escrowPublicKey,
				encryptedSecret,
				encryptionKey,
				custodianPublicKey = this.config.getCustodianPublicKey(),
				amount,
			} = params;

			// Validate required parameters
			if (!custodianPublicKey) {
				throw new Error(
					"Custodian public key is required. Set CUSTODIAN_PUBLIC_KEY environment variable or pass custodianPublicKey parameter.",
				);
			}

			// Decrypt the escrow secret
			const escrowSecret = this.decryptSecret(encryptedSecret, encryptionKey);

			// Load escrow account to get current balance
			const escrowAccount = await this.stellarService
				.getServer()
				.loadAccount(escrowPublicKey);
			const xlmBalance =
				escrowAccount.balances
					.filter((balance: any) => balance.asset_type === "native")
					.map((balance: any) => balance.balance)[0] || "0";

			// Calculate amount to release (all available XLM minus minimum reserve)
			const minimumReserve = "1.0"; // 1 XLM minimum reserve
			const availableBalance = (
				parseFloat(xlmBalance) - parseFloat(minimumReserve)
			).toFixed(7);

			if (parseFloat(availableBalance) <= 0) {
				throw new Error(
					"Insufficient funds in escrow account. Available balance must be greater than minimum reserve.",
				);
			}

			const releaseAmount = amount || availableBalance;

			// Build payment transaction from escrow to custodian
			const transaction = await this.stellarService.buildPaymentTransaction(
				escrowSecret,
				custodianPublicKey,
				releaseAmount,
			);

			// Generate transaction hash for idempotency check
			const txHash = transaction.hash().toString("hex");

			// Idempotency check: ensure this escrow hasn't been released before
			if (this.releasedTransactions.has(txHash)) {
				return {
					txHash,
					successful: true,
					released: false, // Already released
				};
			}

			// Submit the transaction
			const result = await this.stellarService.submitTransaction(transaction);

			// Mark as released if successful
			if (result.successful) {
				this.releasedTransactions.add(txHash);
			}

			return {
				txHash: result.hash,
				successful: result.successful,
				released: result.successful,
			};
		} catch (error) {
			throw new Error(
				`Failed to release escrow funds: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Refunds funds from escrow account back to the owner.
	 * Enforces single-refund rule with idempotency check.
	 * Destination is the owner account; memo is set to 'REFUND'.
	 */
	public async refundEscrowFunds(
		params: EscrowRefundParams,
	): Promise<EscrowRefundResult> {
		try {
			const {
				escrowPublicKey,
				encryptedSecret,
				encryptionKey,
				ownerPublicKey,
				amount,
			} = params;

			// Validate required parameters
			if (!ownerPublicKey) {
				throw new Error(
					"Owner public key is required for refund destination.",
				);
			}

			// Decrypt the escrow secret
			const escrowSecret = this.decryptSecret(encryptedSecret, encryptionKey);
			const escrowKeypair = StellarSdk.Keypair.fromSecret(escrowSecret);

			// Idempotency check: query live escrow account balance
			const server = this.stellarService.getServer();
			const escrowAccount = await server.loadAccount(escrowPublicKey);
			const xlmBalance =
				escrowAccount.balances
					.filter((balance: any) => balance.asset_type === "native")
					.map((balance: any) => balance.balance)[0] || "0";

			// Minimum reserve required to keep the account open
			const minimumReserve = "1.0"; // 1 XLM
			const availableBalance = (
				parseFloat(xlmBalance) - parseFloat(minimumReserve)
			).toFixed(7);

			// If the balance is already depleted this is a duplicate refund attempt
			if (parseFloat(availableBalance) <= 0) {
				throw new Error(
					"Idempotency error: escrow account balance is already depleted. Refund has likely already been processed.",
				);
			}

			const refundAmount = amount || availableBalance;

			// Build the refund transaction manually so we can attach Memo.text('REFUND')
			const transaction = new StellarSdk.TransactionBuilder(escrowAccount, {
				fee: StellarSdk.BASE_FEE,
				networkPassphrase: this.config.getNetworkPassphrase(),
			})
				.addOperation(
					StellarSdk.Operation.payment({
						destination: ownerPublicKey,
						asset: StellarSdk.Asset.native(),
						amount: refundAmount,
					}),
				)
				.addMemo(StellarSdk.Memo.text("REFUND"))
				.setTimeout(30)
				.build();

			// Sign with the escrow account's secret key
			transaction.sign(escrowKeypair);

			// Generate deterministic transaction hash
			const txHash = transaction.hash().toString("hex");

			// Idempotency check: ensure this exact refund tx hasn't been submitted before
			if (this.refundedTransactions.has(txHash)) {
				return {
					txHash,
					successful: true,
					refunded: false,
					idempotent: true,
				};
			}

			// Submit the refund transaction
			const result = await this.stellarService.submitTransaction(transaction);

			// Record the refund to prevent duplicates
			if (result.successful) {
				this.refundedTransactions.add(txHash);
			}

			return {
				txHash: result.hash,
				successful: result.successful,
				refunded: result.successful,
				idempotent: false,
			};
		} catch (error) {
			throw new Error(
				`Failed to refund escrow funds: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}

	/**
	 * Checks if an escrow account has already been refunded
	 */
	public isEscrowRefunded(txHash: string): boolean {
		return this.refundedTransactions.has(txHash);
	}

	/**
	 * Checks if an escrow account has already been released
	 */
	public isEscrowReleased(txHash: string): boolean {
		return this.releasedTransactions.has(txHash);
	}

	/**
	 * Generates a deterministic encryption key from a seed
	 */
	public static generateEncryptionKey(seed: string): string {
		return EncryptionUtils.generateEncryptionKey(seed);
	}

	/**
	 * Validates encrypted secret format
	 */
	public static isValidEncryptedSecret(encryptedSecret: string): boolean {
		return EncryptionUtils.isValidEncryptedFormat(encryptedSecret);
	}

	/**
	 * Sanitizes encrypted secret for logging
	 */
	public static sanitizeForLogging(encryptedSecret: string, maxLength: number = 20): string {
		return EncryptionUtils.sanitizeForLogging(encryptedSecret, maxLength);
	}
}
