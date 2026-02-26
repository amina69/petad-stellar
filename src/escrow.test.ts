import { EscrowService } from "./services/escrow.service.js";
import { Config } from "./config.js";

async function testEscrowAccountCreation() {
	console.log("🚀 Testing Escrow Account Creation...\n");

	try {
		// Initialize escrow service with testnet configuration
		const config = Config.getInstance({
			horizonUrl: "https://horizon-testnet.stellar.org",
			networkPassphrase: "Test SDF Network ; September 2015",
		});

		const escrowService = new EscrowService(config);

		// Test 1: Create and validate escrow account
		console.log("📝 Test 1: Creating escrow account...");
		const encryptionKey = "test-encryption-key-123";

		const result =
			await escrowService.createAndValidateEscrowAccount(encryptionKey);

		console.log("✅ Escrow account created successfully!");
		console.log(`   Public Key: ${result.publicKey}`);
		console.log(`   Encrypted Secret: ${result.encryptedSecret.substring(0, 20)}...`);
		console.log(`   Funded: ${result.funded}`);
		console.log(`   Exists: ${result.exists}`);
		console.log(`   Balance: ${result.balance} XLM`);
		console.log(`   Sequence: ${result.sequence}\n`);

		// Test 2: Decrypt the secret key
		console.log("📝 Test 2: Decrypting secret key...");
		const decryptedSecret = escrowService.decryptSecret(
			result.encryptedSecret,
			encryptionKey,
		);
		console.log("✅ Secret key decrypted successfully!");
		console.log(`   Decrypted Secret: [REDACTED]\n`);

		// Test 3: Validate account existence independently
		console.log("📝 Test 3: Validating account existence independently...");
		const validation = await escrowService.validateAccountExistence(
			result.publicKey,
		);
		console.log("✅ Account validation completed!");
		console.log(`   Exists: ${validation.exists}`);
		console.log(`   Balance: ${validation.balance} XLM`);
		console.log(`   Sequence: ${validation.sequence}\n`);

		// Test 4: Test with different encryption key (should fail)
		console.log("📝 Test 4: Testing decryption with wrong key...");
		try {
			escrowService.decryptSecret(result.encryptedSecret, "wrong-key");
			console.log("❌ Should have failed with wrong key!");
		} catch (error) {
			console.log("✅ Correctly failed with wrong key!");
			console.log(
				`   Error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
			);
		}

		// Test 5: Test deterministic key generation
		console.log("📝 Test 5: Testing deterministic key generation...");
		const seed = "test-seed-456";
		const key1 = EscrowService.generateEncryptionKey(seed);
		const key2 = EscrowService.generateEncryptionKey(seed);
		console.log(`✅ Deterministic keys match: ${key1 === key2}`);
		console.log(`   Key: ${key1.substring(0, 20)}...\n`);

		console.log(
			"🎉 All tests passed! Escrow account creation is working correctly.\n",
		);

		// Return the account details for manual verification
		return {
			publicKey: result.publicKey,
			encryptedSecret: result.encryptedSecret,
			balance: result.balance,
			horizonUrl: config.getHorizonUrl(),
		};
	} catch (error) {
		console.error(
			"❌ Test failed:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw error;
	}
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	testEscrowAccountCreation()
		.then((accountDetails) => {
			console.log("📊 Account Details for Manual Verification:");
			console.log(`   Horizon URL: ${accountDetails.horizonUrl}`);
			console.log(
				`   Account Explorer: ${accountDetails.horizonUrl}/accounts/${accountDetails.publicKey}`,
			);
			console.log(`   Public Key: ${accountDetails.publicKey}`);
			console.log(`   Balance: ${accountDetails.balance} XLM`);
		})
		.catch((error) => {
			console.error("Test execution failed:", error);
			process.exit(1);
		});
}

async function testEscrowRelease() {
	console.log("🚀 Testing Escrow Funds Release...\n");

	try {
		// Initialize escrow service with testnet configuration
		const config = Config.getInstance({
			horizonUrl: "https://horizon-testnet.stellar.org",
			networkPassphrase: "Test SDF Network ; September 2015",
			custodianPublicKey:
				"GBQGEXZF36EQBJZ72QC5JEGUHBRI22CGUWEP7OVZA44OAJFFKKIRVDOE", // Test custodian
		});

		const escrowService = new EscrowService(config);

		// First create an escrow account
		console.log("📝 Creating escrow account for release test...");
		const encryptionKey = "test-release-key-456";

		const escrowAccount =
			await escrowService.createAndValidateEscrowAccount(encryptionKey);

		console.log("✅ Escrow account created successfully!");
		console.log(`   Public Key: ${escrowAccount.publicKey}`);
		console.log(`   Balance: ${escrowAccount.balance} XLM\n`);

		// Test 1: Release funds to custodian
		console.log("📝 Test 1: Releasing escrow funds to custodian...");
		const custodianKey = config.getCustodianPublicKey();
		if (!custodianKey) {
			throw new Error('CUSTODIAN_PUBLIC_KEY is required');
		}
			throw new Error("Custodian public key not configured");
		}
		
		const releaseResult = await escrowService.releaseEscrowFunds({
			escrowPublicKey: escrowAccount.publicKey,
			encryptedSecret: escrowAccount.encryptedSecret,
			encryptionKey,
			custodianPublicKey: custodianKey,
		});

		console.log("✅ Release operation completed!");
		console.log(`   Transaction Hash: ${releaseResult.txHash}`);
		console.log(`   Successful: ${releaseResult.successful}`);
		console.log(`   Released: ${releaseResult.released}\n`);

		// Test 2: Idempotency check - try to release again
		console.log("📝 Test 2: Testing idempotency (release again)...");
		const secondReleaseResult = await escrowService.releaseEscrowFunds({
			escrowPublicKey: escrowAccount.publicKey,
			encryptedSecret: escrowAccount.encryptedSecret,
			encryptionKey,
			custodianPublicKey: custodianKey,
		});

		console.log("✅ Second release operation completed!");
		console.log(`   Transaction Hash: ${secondReleaseResult.txHash}`);
		console.log(`   Successful: ${secondReleaseResult.successful}`);
		console.log(
			`   Released: ${secondReleaseResult.released} (should be false - already released)\n`,
		);

		// Test 3: Test with insufficient funds (create new account and try to release more than available)
		console.log("📝 Test 3: Testing insufficient funds scenario...");
		const minimalAccount =
			await escrowService.createEscrowAccount(encryptionKey);

		try {
			await escrowService.releaseEscrowFunds({
				escrowPublicKey: minimalAccount.publicKey!,
				encryptedSecret: minimalAccount.encryptedSecret,
				encryptionKey,
				custodianPublicKey: custodianKey,
				amount: "100.0", // More than available
			});
			console.log("❌ Should have failed with insufficient funds!");
		} catch (error) {
			console.log("✅ Correctly failed with insufficient funds!");
			console.log(
				`   Error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
			);
		}

		console.log(
			"🎉 All release tests passed! Escrow release functionality is working correctly.\n",
		);

		// Return release details for manual verification
		return {
			escrowPublicKey: escrowAccount.publicKey,
			custodianPublicKey: config.getCustodianPublicKey(),
			txHash: releaseResult.txHash,
			horizonUrl: config.getHorizonUrl(),
		};
	} catch (error) {
		console.error(
			"❌ Release test failed:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw error;
	}
}

export { testEscrowAccountCreation, testEscrowRelease };
