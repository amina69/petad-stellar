#!/usr/bin/env node

import PetAdChain from '../index.js';
import * as dotenv from 'dotenv';

dotenv.config();

interface AnchorTrustHashOptions {
  hash: string;
  secretKey?: string;
  testnet?: boolean;
}

async function anchorTrustHash(options: AnchorTrustHashOptions) {
  const { hash, secretKey, testnet = true } = options;

  console.log('🔒 Anchoring Trust Hash\n');

  try {
    if (hash.length > 28) {
      throw new Error('Hash exceeds 28 bytes limit for memo text');
    }

    const chain = new PetAdChain({ useTestnet: testnet });
    console.log(`🌐 Network: ${testnet ? 'Testnet' : 'Mainnet'}`);
    console.log(`📝 Hash: ${hash} (${hash.length} bytes)\n`);

    const secret = secretKey || chain.getConfig().getMasterSecret();
    if (!secret) {
      throw new Error('Secret key is required (provide --secret or set MASTER_SECRET in .env)');
    }

    console.log('⏳ Creating self-payment transaction with hash in memo...');
    const startTime = Date.now();

    const result = await chain.anchorTrustHash(hash, secret);

    const endTime = Date.now();
    console.log(`✅ Hash anchored in ${endTime - startTime}ms\n`);

    console.log('📊 Result:');
    console.log(`   Transaction Hash: ${result.hash}`);
    console.log(`   Verified: ${result.verified}`);
    console.log(`   Timestamp: ${result.timestamp?.toISOString()}`);
    console.log(`   Amount: 0.00001 XLM (self-payment)\n`);

    const horizonUrl = testnet
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org';
    console.log('🔗 View on Stellar:');
    console.log(`   ${horizonUrl}/transactions/${result.hash}\n`);

    return result;
  } catch (error) {
    console.error('❌ Failed to anchor trust hash:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run anchor-trust-hash -- --hash <hash> [options]

Options:
  --hash <hash>       Trust hash to anchor (max 28 bytes)
  --secret <key>      Secret key (optional, uses MASTER_SECRET from .env)
  --mainnet           Use mainnet instead of testnet
  --help, -h          Show this help message

Examples:
  npm run anchor-trust-hash -- --hash "trust-snapshot-123"
  npm run anchor-trust-hash -- --hash "abc123" --secret SXXX...
  npm run anchor-trust-hash -- --hash "prod-hash" --mainnet
`);
    process.exit(0);
  }

  const options: AnchorTrustHashOptions = {
    hash: '',
    testnet: !args.includes('--mainnet'),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hash' && i + 1 < args.length) {
      options.hash = args[i + 1]!;
      i++;
    } else if (args[i] === '--secret' && i + 1 < args.length) {
      options.secretKey = args[i + 1]!;
      i++;
    }
  }

  if (!options.hash) {
    console.error('❌ Error: --hash is required');
    process.exit(1);
  }

  anchorTrustHash(options)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { anchorTrustHash };
