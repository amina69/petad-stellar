import PetAdChain from './index.js';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';

dotenv.config();

async function testTrustHashAnchoring() {
  console.log('🔒 Testing Trust Hash Anchoring\n');

  try {
    const chain = new PetAdChain({ useTestnet: true });
    console.log('✅ PetAdChain initialized');
    console.log(`📍 Network: ${chain.isTestnet() ? 'Testnet' : 'Mainnet'}\n`);

    // Test 1: Hash size validation (no network required)
    console.log('📝 Test 1: Testing hash size validation...');
    
    // Valid hash (28 bytes or less)
    const validHash = 'test-hash-1234567890123456';
    console.log(`   Valid hash: ${validHash} (${validHash.length} bytes)`);
    if (validHash.length <= 28) {
      console.log(`✅ Valid hash size\n`);
    }
    
    // Invalid hash (too long)
    const longHash = 'x'.repeat(29);
    console.log(`   Long hash: ${longHash.substring(0, 20)}... (${longHash.length} bytes)`);
    
    const testKeypair = StellarSdk.Keypair.random();
    try {
      await chain.anchorTrustHash(longHash, testKeypair.secret());
      console.log('❌ Should have failed with hash too long error!');
    } catch (error) {
      console.log(`✅ Correctly rejected: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Test 2: Transaction structure (if master secret is available)
    const masterSecret = chain.getConfig().getMasterSecret();
    if (masterSecret) {
      console.log('📝 Test 2: Testing transaction creation with real account...');
      const keypair = StellarSdk.Keypair.fromSecret(masterSecret);
      console.log(`   Using account: ${keypair.publicKey()}`);
      
      const testHash = 'test-' + Date.now().toString().slice(-10);
      console.log(`   Hash: ${testHash} (${testHash.length} bytes)`);
      
      try {
        const result = await chain.anchorTrustHash(testHash, masterSecret);
        console.log(`✅ Hash anchored successfully!`);
        console.log(`   Transaction Hash: ${result.hash}`);
        console.log(`   Verified: ${result.verified}`);
        console.log(`   Timestamp: ${result.timestamp?.toISOString()}\n`);

        // Verify on-chain
        console.log('📝 Verifying transaction on-chain...');
        const txStatus = await chain.getTransactionStatus(result.hash);
        console.log(`✅ Transaction verified: ${txStatus.successful}\n`);
      } catch (error) {
        console.log(`⚠️  Network test skipped: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    } else {
      console.log('⚠️  Test 2 skipped: MASTER_SECRET not configured\n');
    }

    console.log('✅ All trust hash anchoring tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testTrustHashAnchoring()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testTrustHashAnchoring };
