#!/usr/bin/env node

import { EscrowService } from '../services/escrow.service.js';
import { Config } from '../config.js';

interface CreateEscrowOptions {
  encryptionKey?: string;
  testnet?: boolean;
  validate?: boolean;
}

async function createEscrowAccount(options: CreateEscrowOptions = {}) {
  const {
    encryptionKey = process.env.ENCRYPTION_KEY,
    testnet = true,
    validate = true
  } = options;

  console.log('🔐 Creating Stellar Escrow Account\n');

  try {
    // Configure for testnet or mainnet
    const config = Config.getInstance({
      horizonUrl: testnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org',
      networkPassphrase: testnet 
        ? 'Test SDF Network ; September 2015' 
        : 'Public Global Stellar Network ; September 2015'
    });

    const escrowService = new EscrowService(config);

    console.log(`🌐 Network: ${testnet ? 'Testnet' : 'Mainnet'}`);
    console.log(`🔑 Encryption Key: ${encryptionKey ? 'Provided' : 'Using MASTER_SECRET from environment'}`);
    console.log(`✅ Validation: ${validate ? 'Enabled' : 'Disabled'}\n`);

    // Create the escrow account
    console.log('⏳ Creating escrow account...');
    const startTime = Date.now();

    let result;
    if (validate) {
      result = await escrowService.createAndValidateEscrowAccount(encryptionKey);
    } else {
      result = await escrowService.createEscrowAccount(encryptionKey);
    }

    const endTime = Date.now();
    console.log(`✅ Account created in ${endTime - startTime}ms\n`);

    // Display results
    console.log('📊 Account Details:');
    console.log('─'.repeat(50));
    console.log(`🔓 Public Key: ${result.publicKey}`);
    console.log(`🔐 Encrypted Secret: ${result.encryptedSecret.substring(0, 20)}...`);
    
    if ('exists' in result && result.exists) {
      console.log(`✅ Account Exists: ${result.exists}`);
      console.log(`💰 Balance: ${(result as any).balance} XLM`);
      console.log(`🔢 Sequence: ${(result as any).sequence}`);
    }
    
    console.log(`💳 Funded: ${result.funded}`);
    console.log('─'.repeat(50));

    // Provide Horizon explorer link
    const explorerUrl = `${config.getHorizonUrl()}/accounts/${result.publicKey}`;
    console.log(`\n🔍 View on Horizon Explorer:`);
    console.log(`${explorerUrl}`);

    // Instructions for decryption
    console.log(`\n📝 To decrypt the secret key:`);
    console.log(`const escrowService = new EscrowService();`);
    console.log(`const secret = escrowService.decryptSecret(encryptedSecret, 'YOUR_ENCRYPTION_KEY');`);

    return result;

  } catch (error) {
    console.error('❌ Failed to create escrow account:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('No encryption key provided')) {
      console.log('\n💡 Solution: Set ENCRYPTION_KEY environment variable or pass --key option');
    }
    
    if (error instanceof Error && error.message.includes('MASTER_SECRET required for mainnet')) {
      console.log('\n💡 Solution: Set MASTER_SECRET environment variable for mainnet funding');
    }
    
    process.exit(1);
  }
}

// CLI argument parsing
function parseArgs(): CreateEscrowOptions {
  const args = process.argv.slice(2);
  const options: CreateEscrowOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--key':
      case '-k':
        const keyArg = args[++i];
        if (keyArg) {
          options.encryptionKey = keyArg;
        }
        break;
      case '--mainnet':
        options.testnet = false;
        break;
      case '--no-validate':
        options.validate = false;
        break;
      case '--help':
      case '-h':
        console.log(`
Stellar Escrow Account Creator

Usage: npm run create-escrow [options]

Options:
  --key, -k <key>        Encryption key for secret encryption
  --mainnet             Use mainnet instead of testnet (requires MASTER_SECRET)
  --no-validate         Skip account validation after creation
  --help, -h            Show this help message

Environment Variables:
  ENCRYPTION_KEY        Default encryption key
  MASTER_SECRET         Master account secret for mainnet funding

Examples:
  npm run create-escrow
  npm run create-escrow --key "my-secret-key"
  npm run create-escrow --mainnet --key "my-secret-key"
        `);
        process.exit(0);
    }
  }

  return options;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  createEscrowAccount(options);
}

export { createEscrowAccount };
