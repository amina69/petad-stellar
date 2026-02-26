import * as crypto from "crypto";

/**
 * Secure encryption utilities for escrow secret management
 * Implements AES-256-GCM encryption with secure key derivation
 */
export class EncryptionUtils {
	private static readonly ALGORITHM = "aes-256-gcm";
	private static readonly IV_LENGTH = 16;
	private static readonly AUTH_TAG_LENGTH = 16;

	/**
	 * Encrypts a secret key using AES-256-GCM
	 * @param secret - The secret to encrypt
	 * @param encryptionKey - The encryption key (will be hashed)
	 * @returns Base64 encoded encrypted data (iv + authTag + encrypted)
	 */
	public static encryptSecret(secret: string, encryptionKey: string): string {
		if (!secret || !encryptionKey) {
			throw new Error("Secret and encryption key are required");
		}

		const keyBuffer = crypto.createHash("sha256").update(encryptionKey).digest();
		const iv = crypto.randomBytes(this.IV_LENGTH);
		const cipher = crypto.createCipheriv(this.ALGORITHM, keyBuffer, iv);

		let encrypted = cipher.update(secret, "utf8", "hex");
		encrypted += cipher.final("hex");

		const authTag = cipher.getAuthTag();

		// Combine iv + authTag + encrypted data
		const combined = Buffer.concat([
			iv,
			authTag,
			Buffer.from(encrypted, "hex"),
		]);

		return combined.toString("base64");
	}

	/**
	 * Decrypts a secret key using AES-256-GCM
	 * @param encryptedSecret - Base64 encoded encrypted data
	 * @param encryptionKey - The encryption key (will be hashed)
	 * @returns The decrypted secret
	 */
	public static decryptSecret(encryptedSecret: string, encryptionKey: string): string {
		if (!encryptedSecret || !encryptionKey) {
			throw new Error("Encrypted secret and encryption key are required");
		}

		const keyBuffer = crypto.createHash("sha256").update(encryptionKey).digest();
		const combined = Buffer.from(encryptedSecret, "base64");

		const iv = combined.slice(0, this.IV_LENGTH);
		const authTag = combined.slice(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
		const encrypted = combined.slice(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

		const decipher = crypto.createDecipheriv(this.ALGORITHM, keyBuffer, iv);
		decipher.setAuthTag(authTag);

		try {
			let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
			decrypted += decipher.final("utf8");
			return decrypted;
		} catch (error) {
			throw new Error("Failed to decrypt secret - invalid key or corrupted data");
		}
	}

	/**
	 * Generates a deterministic encryption key from a seed
	 * @param seed - The seed value
	 * @returns Hex string of the derived key
	 */
	public static generateEncryptionKey(seed: string): string {
		if (!seed) {
			throw new Error("Seed is required for key generation");
		}
		return crypto.createHash("sha256").update(seed).digest("hex");
	}

	/**
	 * Securely logs encrypted data without exposing sensitive information
	 * @param encryptedSecret - The encrypted secret to log
	 * @param maxLength - Maximum characters to show (default: 20)
	 * @returns Safe string for logging
	 */
	public static sanitizeForLogging(encryptedSecret: string, maxLength: number = 20): string {
		if (!encryptedSecret) {
			return "[EMPTY]";
		}
		return `${encryptedSecret.substring(0, maxLength)}...`;
	}

	/**
	 * Validates if a string looks like a valid encrypted secret
	 * @param encryptedSecret - The encrypted secret to validate
	 * @returns True if valid format
	 */
	public static isValidEncryptedFormat(encryptedSecret: string): boolean {
		if (!encryptedSecret || typeof encryptedSecret !== "string") {
			return false;
		}

		try {
			const combined = Buffer.from(encryptedSecret, "base64");
			return combined.length >= this.IV_LENGTH + this.AUTH_TAG_LENGTH;
		} catch {
			return false;
		}
	}
}
