#!/usr/bin/env node

import { EscrowService } from "../services/escrow.service.js";
import { Config } from "../config.js";

interface ReleaseEscrowOptions {
	escrowPublicKey: string;
	encryptedSecret: string;
	encryptionKey?: string;
	custodianPublicKey?: string;
	amount?: string;
	testnet?: boolean;
}

async function releaseEscrowFunds(options: ReleaseEscrowOptions) {
	const {
		escrowPublicKey,
		encryptedSecret,
		encryptionKey = process.env.ENCRYPTION_KEY || '',
		custodianPublicKey = process.env.CUSTODIAN_PUBLIC_KEY || '',
		amount,
		testnet = true,
	} = options;

	console.log("🔓 Releasing Escrow Funds\n");

	try {
		if (!encryptionKey) {
			throw new Error('ENCRYPTION_KEY is required');
		}
		if (!custodianPublicKey) {
			throw new Error('CUSTODIAN_PUBLIC_KEY is required');
		}

		// Configure for testnet or mainnet
		const configOptions: Partial<import("../config.js").EnvConfig> = {
			horizonUrl: testnet
				? "https://horizon-testnet.stellar.org"
				: "https://horizon.stellar.org",
			networkPassphrase: testnet
				? "Test SDF Network ; September 2015"
				: "Public Global Stellar Network ; September 2015",
		};
		
		if (custodianPublicKey) {
			configOptions.custodianPublicKey = custodianPublicKey;
		}
		
		const config = Config.getInstance(configOptions);

		const escrowService = new EscrowService(config);

		console.log(`🌐 Network: ${testnet ? "Testnet" : "Mainnet"}`);
		console.log(`🔑 Escrow Public Key: ${escrowPublicKey}`);
		console.log(`🔐 Encrypted Secret: ${encryptedSecret.substring(0, 20)}...`);
		console.log(`👤 Custodian Public Key: ${custodianPublicKey}`);
		console.log(`💰 Amount: ${amount || "All available funds"}`);
		console.log(
			`🔑 Encryption Key: ${encryptionKey ? "Provided" : "Using ENCRYPTION_KEY from environment"}\n`,
		);

		// Release escrow funds
		console.log("⏳ Releasing escrow funds...");
		const startTime = Date.now();

		const releaseParams: any = {
			escrowPublicKey,
			encryptedSecret,
			encryptionKey,
			custodianPublicKey,
		};
		const releaseParams: import("../services/escrow.service.js").EscrowReleaseParams = {
			escrowPublicKey,
			encryptedSecret,
		};
		
		if (encryptionKey) {
			releaseParams.encryptionKey = encryptionKey;
		}
		if (custodianPublicKey) {
			releaseParams.custodianPublicKey = custodianPublicKey;
		}
		if (amount) {
			releaseParams.amount = amount;
		}

		const result = await escrowService.releaseEscrowFunds(releaseParams);

		const endTime = Date.now();
		console.log(`✅ Release completed in ${endTime - startTime}ms\n`);

		// Display results
		console.log("📊 Release Results:");
		console.log("─".repeat(50));
		console.log(`🔗 Transaction Hash: ${result.txHash}`);
		console.log(`✅ Successful: ${result.successful}`);
		console.log(`🔓 Released: ${result.released}`);
		console.log("─".repeat(50));

		// Provide Horizon explorer link
		const explorerUrl = `${config.getHorizonUrl()}/transactions/${result.txHash}`;
		console.log(`\n🔍 View Transaction on Horizon Explorer:`);
		console.log(`${explorerUrl}`);

		if (!result.released) {
			console.log(
				`\n⚠️  Note: Funds were not released (already released or failed)`,
			);
		}

		return result;
	} catch (error) {
		console.error(
			"❌ Failed to release escrow funds:",
			error instanceof Error ? error.message : "Unknown error",
		);

		if (
			error instanceof Error &&
			error.message.includes("Custodian public key is required")
		) {
			console.log(
				"\n💡 Solution: Set CUSTODIAN_PUBLIC_KEY environment variable or pass --custodian option",
			);
		}

		if (
			error instanceof Error &&
			error.message.includes("No encryption key provided")
		) {
			console.log(
				"\n💡 Solution: Set ENCRYPTION_KEY environment variable or pass --key option",
			);
		}

		process.exit(1);
	}
}

// CLI argument parsing
function parseArgs(): ReleaseEscrowOptions {
	const args = process.argv.slice(2);
	const options: ReleaseEscrowOptions = {} as ReleaseEscrowOptions;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		switch (arg) {
			case "--escrow-key":
			case "-e":
				const escrowKeyArg = args[++i];
				if (escrowKeyArg) {
					options.escrowPublicKey = escrowKeyArg;
				}
				break;
			case "--encrypted-secret":
			case "-s":
				const secretArg = args[++i];
				if (secretArg) {
					options.encryptedSecret = secretArg;
				}
				break;
			case "--key":
			case "-k":
				const keyArg = args[++i];
				if (keyArg) {
					options.encryptionKey = keyArg;
				}
				break;
			case "--custodian":
			case "-c":
				const custodianArg = args[++i];
				if (custodianArg) {
					options.custodianPublicKey = custodianArg;
				}
				break;
			case "--amount":
			case "-a":
				const amountArg = args[++i];
				if (amountArg) {
					options.amount = amountArg;
				}
				break;
			case "--mainnet":
				options.testnet = false;
				break;
			case "--help":
			case "-h":
				console.log(`
Stellar Escrow Funds Release

Usage: npm run release-escrow [options]

Required Options:
  --escrow-key, -e <key>        Escrow account public key
  --encrypted-secret, -s <secret> Encrypted escrow secret

Optional Options:
  --key, -k <key>               Encryption key for secret decryption
  --custodian, -c <key>         Custodian public key (default: CUSTODIAN_PUBLIC_KEY env)
  --amount, -a <amount>         Amount to release (default: all available funds)
  --mainnet                     Use mainnet instead of testnet
  --help, -h                    Show this help message

Environment Variables:
  ENCRYPTION_KEY                Default encryption key
  CUSTODIAN_PUBLIC_KEY          Default custodian public key

Examples:
  npm run release-escrow --escrow-key GABC... --encrypted-secret <encrypted>
  npm run release-escrow -e GABC... -s <encrypted> --custodian GDEF...
  npm run release-escrow -e GABC... -s <encrypted> --amount 10.0
        `);
				process.exit(0);
		}
	}

	// Validate required arguments
	if (!options.escrowPublicKey || !options.encryptedSecret) {
		console.error("❌ Error: --escrow-key and --encrypted-secret are required");
		console.log("Run with --help for usage information");
		process.exit(1);
	}

	return options;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const options = parseArgs();
	releaseEscrowFunds(options);
}

export { releaseEscrowFunds };
