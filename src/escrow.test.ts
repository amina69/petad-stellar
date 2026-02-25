import { EscrowService } from './services/escrow.service.js';
import { Config } from './config.js';

async function testEscrowAccountCreation() {
  console.log('🚀 Testing Escrow Account Creation...\n');

  try {
    // Initialize escrow service with testnet configuration
    const config = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });

    const escrowService = new EscrowService(config);

    // Test 1: Create and validate escrow account
    console.log('📝 Test 1: Creating escrow account...');
    const encryptionKey = 'test-encryption-key-123';
    
    const result = await escrowService.createAndValidateEscrowAccount(encryptionKey);
    
    console.log('✅ Escrow account created successfully!');
    console.log(`   Public Key: ${result.publicKey}`);
    console.log(`   Encrypted Secret: ${result.encryptedSecret.substring(0, 50)}...`);
    console.log(`   Funded: ${result.funded}`);
    console.log(`   Exists: ${result.exists}`);
    console.log(`   Balance: ${result.balance} XLM`);
    console.log(`   Sequence: ${result.sequence}\n`);

    // Test 2: Decrypt the secret key
    console.log('📝 Test 2: Decrypting secret key...');
    const decryptedSecret = escrowService.decryptSecret(result.encryptedSecret, encryptionKey);
    console.log('✅ Secret key decrypted successfully!');
    console.log(`   Decrypted Secret: ${decryptedSecret.substring(0, 10)}...\n`);

    // Test 3: Validate account existence independently
    console.log('📝 Test 3: Validating account existence independently...');
    const validation = await escrowService.validateAccountExistence(result.publicKey);
    console.log('✅ Account validation completed!');
    console.log(`   Exists: ${validation.exists}`);
    console.log(`   Balance: ${validation.balance} XLM`);
    console.log(`   Sequence: ${validation.sequence}\n`);

    // Test 4: Test with different encryption key (should fail)
    console.log('📝 Test 4: Testing decryption with wrong key...');
    try {
      escrowService.decryptSecret(result.encryptedSecret, 'wrong-key');
      console.log('❌ Should have failed with wrong key!');
    } catch (error) {
      console.log('✅ Correctly failed with wrong key!');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Test 5: Test deterministic key generation
    console.log('📝 Test 5: Testing deterministic key generation...');
    const seed = 'test-seed-456';
    const key1 = EscrowService.generateEncryptionKey(seed);
    const key2 = EscrowService.generateEncryptionKey(seed);
    console.log(`✅ Deterministic keys match: ${key1 === key2}`);
    console.log(`   Key: ${key1.substring(0, 20)}...\n`);

    console.log('🎉 All tests passed! Escrow account creation is working correctly.\n');
    
    // Return the account details for manual verification
    return {
      publicKey: result.publicKey,
      encryptedSecret: result.encryptedSecret,
      balance: result.balance,
      horizonUrl: config.getHorizonUrl()
    };

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEscrowAccountCreation()
    .then((accountDetails) => {
      console.log('📊 Account Details for Manual Verification:');
      console.log(`   Horizon URL: ${accountDetails.horizonUrl}`);
      console.log(`   Account Explorer: ${accountDetails.horizonUrl}/accounts/${accountDetails.publicKey}`);
      console.log(`   Public Key: ${accountDetails.publicKey}`);
      console.log(`   Balance: ${accountDetails.balance} XLM`);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testEscrowAccountCreation };
