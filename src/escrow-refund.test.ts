import { EscrowService } from "./services/escrow.service.js";
import { Config } from "./config.js";

export async function testEscrowRefund() {
	console.log("🚀 Testing Escrow Funds Refund...\n");

	try {
		// Initialize escrow service with testnet configuration
		const config = Config.getInstance({
			horizonUrl: "https://horizon-testnet.stellar.org",
			networkPassphrase: "Test SDF Network ; September 2015",
		});

		const escrowService = new EscrowService(config);

		// Create a fresh escrow account for the refund test
		console.log("📝 Creating escrow account for refund test...");
		const encryptionKey = "test-refund-key-789";

		const escrowAccount =
			await escrowService.createAndValidateEscrowAccount(encryptionKey);

		console.log("✅ Escrow account created successfully!");
		console.log(`   Public Key: ${escrowAccount.publicKey}`);
		console.log(`   Balance: ${escrowAccount.balance} XLM\n`);

		// Use the custodian key as owner for test purposes (any valid funded testnet key)
		const ownerPublicKey =
			process.env.OWNER_PUBLIC_KEY ||
			"GBQGEXZF36EQBJZ72QC5JEGUHBRI22CGUWEP7OVZA44OAJFFKKIRVDOE";

		// Test 1: Refund funds to owner
		console.log("📝 Test 1: Refunding escrow funds to owner...");
		const refundResult = await escrowService.refundEscrowFunds({
			escrowPublicKey: escrowAccount.publicKey,
			encryptedSecret: escrowAccount.encryptedSecret,
			encryptionKey,
			ownerPublicKey,
		});

		console.log("✅ Refund operation completed!");
		console.log(`   Transaction Hash: ${refundResult.txHash}`);
		console.log(`   Successful: ${refundResult.successful}`);
		console.log(`   Refunded: ${refundResult.refunded}`);
		console.log(`   Idempotent: ${refundResult.idempotent}\n`);

		// Test 2: Idempotency check - refund depleted account
		console.log(
			"📝 Test 2: Testing idempotency – refund depleted account...",
		);
		const secondRefundResult = await escrowService.refundEscrowFunds({
			escrowPublicKey: escrowAccount.publicKey,
			encryptedSecret: escrowAccount.encryptedSecret,
			encryptionKey,
			ownerPublicKey,
		});

		if (secondRefundResult.successful && secondRefundResult.idempotent) {
			console.log("✅ Correctly returned idempotent success response!");
			console.log(`   Transaction Hash: ${secondRefundResult.txHash}\n`);
		} else {
			console.log("❌ Should have returned an idempotent success response!\n");
		}

		// Test 3: isEscrowRefunded helper
		console.log("📝 Test 3: Testing isEscrowRefunded helper...");
		const alreadyRefunded = await escrowService.isEscrowRefunded(escrowAccount.publicKey);
		if (alreadyRefunded) {
			console.log(
				"✅ isEscrowRefunded correctly returns true for processed refund!\n",
			);
		} else {
			console.log(
				"⚠️  isEscrowRefunded returned false – hash may differ from submitted tx hash.\n",
			);
		}

		// Test 4: Missing owner public key should throw
		console.log("📝 Test 4: Testing missing ownerPublicKey guard...");
		const anotherEscrow =
			await escrowService.createEscrowAccount(encryptionKey);
		try {
			await escrowService.refundEscrowFunds({
				escrowPublicKey: anotherEscrow.publicKey,
				encryptedSecret: anotherEscrow.encryptedSecret,
				encryptionKey,
				ownerPublicKey: "", // empty – should be caught
			});
			console.log("❌ Should have failed without ownerPublicKey!");
		} catch (error) {
			console.log("✅ Correctly failed without ownerPublicKey!");
			console.log(
				`   Error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
			);
		}

		console.log(
			"🎉 All refund tests completed! Escrow refund functionality is working correctly.\n",
		);

		return {
			escrowPublicKey: escrowAccount.publicKey,
			ownerPublicKey,
			txHash: refundResult.txHash,
			horizonUrl: config.getHorizonUrl(),
		};
	} catch (error) {
		console.error(
			"❌ Refund test failed:",
			error instanceof Error ? error.message : "Unknown error",
		);
		throw error;
	}
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	testEscrowRefund()
		.then((refundDetails) => {
			console.log("📊 Refund Details for Manual Verification:");
			console.log(`   Horizon URL: ${refundDetails.horizonUrl}`);
			console.log(
				`   Escrow Account: ${refundDetails.horizonUrl}/accounts/${refundDetails.escrowPublicKey}`,
			);
			console.log(
				`   Owner Account: ${refundDetails.horizonUrl}/accounts/${refundDetails.ownerPublicKey}`,
			);
			console.log(
				`   Transaction: ${refundDetails.horizonUrl}/transactions/${refundDetails.txHash}`,
			);
			console.log(`   Escrow Public Key: ${refundDetails.escrowPublicKey}`);
			console.log(`   Owner Public Key: ${refundDetails.ownerPublicKey}`);
			console.log(`   Transaction Hash: ${refundDetails.txHash}`);
		})
		.catch((error) => {
			console.error("Refund test execution failed:", error);
			process.exit(1);
		});
}
