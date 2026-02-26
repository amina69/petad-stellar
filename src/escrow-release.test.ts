import { testEscrowRelease } from "./escrow.test.js";
import { EscrowService } from "./services/escrow.service.js";
import { Config } from "./config.js";

async function testEscrowRelease() {
	console.log("🧪 Testing Escrow Release Functionality\n");

	const encryptionKey = process.env.ENCRYPTION_KEY || "test-release-key-456";
	const custodianPublicKey = process.env.CUSTODIAN_PUBLIC_KEY;

	if (!custodianPublicKey) {
		throw new Error(
			"CUSTODIAN_PUBLIC_KEY environment variable is required for release tests",
		);
	}

	const configOptions: Partial<import("./config.js").EnvConfig> = {
		horizonUrl: "https://horizon-testnet.stellar.org",
		networkPassphrase: "Test SDF Network ; September 2015",
	};
	
	if (custodianPublicKey) {
		configOptions.custodianPublicKey = custodianPublicKey;
	}

	const config = Config.getInstance(configOptions);

	const escrowService = new EscrowService(config);

	// Create and fund escrow account
	console.log("Creating escrow account...");
	const escrowAccount =
		await escrowService.createAndValidateEscrowAccount(encryptionKey);
	console.log(`✅ Escrow account created: ${escrowAccount.publicKey}`);
	console.log(`   Balance: ${escrowAccount.balance} XLM\n`);

	// Release funds to custodian
	console.log("Releasing escrow funds to custodian...");
	const releaseResult = await escrowService.releaseEscrowFunds({
		escrowPublicKey: escrowAccount.publicKey,
		encryptedSecret: escrowAccount.encryptedSecret,
		encryptionKey,
		custodianPublicKey,
	});

	console.log(`✅ Release successful!`);
	console.log(`   Transaction Hash: ${releaseResult.txHash}`);
	console.log(`   Released: ${releaseResult.released}\n`);

	return {
		escrowPublicKey: escrowAccount.publicKey,
		custodianPublicKey,
		txHash: releaseResult.txHash,
		horizonUrl: config.getHorizonUrl(),
	};
}

// Run the release test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	testEscrowRelease()
		.then((releaseDetails) => {
			console.log("📊 Release Details for Manual Verification:");
			console.log(`   Horizon URL: ${releaseDetails.horizonUrl}`);
			console.log(
				`   Escrow Account: ${releaseDetails.horizonUrl}/accounts/${releaseDetails.escrowPublicKey}`,
			);
			console.log(
				`   Custodian Account: ${releaseDetails.horizonUrl}/accounts/${releaseDetails.custodianPublicKey}`,
			);
			console.log(
				`   Transaction: ${releaseDetails.horizonUrl}/transactions/${releaseDetails.txHash}`,
			);
			console.log(`   Escrow Public Key: ${releaseDetails.escrowPublicKey}`);
			console.log(
				`   Custodian Public Key: ${releaseDetails.custodianPublicKey}`,
			);
			console.log(`   Transaction Hash: ${releaseDetails.txHash}`);
		})
		.catch((error) => {
			console.error("Release test execution failed:", error);
			process.exit(1);
		});
}
