import { generateKeypair } from '../src/accounts/keypair.js';
import * as StellarSdk from '@stellar/stellar-sdk';

async function testKeypairGeneration() {
  console.log('🔑 Testing Keypair Generation...\n');

  try {
    // Test 1: Generate valid Stellar keypair with correct format
    console.log('📝 Test 1: Generating keypair and validating format...');
    const keypair = generateKeypair();
    
    // Check that publicKey starts with 'G' and has correct length (56 characters)
    if (!keypair.publicKey.match(/^G[A-Z0-9]{55}$/)) {
      throw new Error(`Invalid public key format: ${keypair.publicKey}`);
    }
    
    // Check that secretKey starts with 'S' and has correct length (56 characters)
    if (!keypair.secretKey.match(/^S[A-Z0-9]{55}$/)) {
      throw new Error(`Invalid secret key format: ${keypair.secretKey}`);
    }
    
    // Verify the keys are valid Stellar keys
    try {
      StellarSdk.Keypair.fromPublicKey(keypair.publicKey);
      StellarSdk.Keypair.fromSecret(keypair.secretKey);
    } catch (error) {
      throw new Error(`Keys are not valid Stellar keys: ${error}`);
    }
    
    // Verify the secret key corresponds to the public key
    const derivedKeypair = StellarSdk.Keypair.fromSecret(keypair.secretKey);
    if (derivedKeypair.publicKey() !== keypair.publicKey) {
      throw new Error('Secret key does not correspond to public key');
    }
    
    console.log(`✅ Public Key: ${keypair.publicKey}`);
    console.log(`✅ Secret Key: ${keypair.secretKey.substring(0, 8)}... (truncated for security)`);
    console.log('✅ Test 1 passed: Valid keypair format\n');

    // Test 2: Generate different keypairs on multiple calls
    console.log('📝 Test 2: Testing multiple calls produce different keypairs...');
    const keypair1 = generateKeypair();
    const keypair2 = generateKeypair();
    
    // Both should be valid
    if (!keypair1.publicKey.match(/^G[A-Z0-9]{55}$/) || !keypair1.secretKey.match(/^S[A-Z0-9]{55}$/)) {
      throw new Error('First keypair has invalid format');
    }
    
    if (!keypair2.publicKey.match(/^G[A-Z0-9]{55}$/) || !keypair2.secretKey.match(/^S[A-Z0-9]{55}$/)) {
      throw new Error('Second keypair has invalid format');
    }
    
    // But they should be different
    if (keypair1.publicKey === keypair2.publicKey || keypair1.secretKey === keypair2.secretKey) {
      throw new Error('Keypairs are not unique - same keys generated twice');
    }
    
    console.log(`✅ First keypair: ${keypair1.publicKey}`);
    console.log(`✅ Second keypair: ${keypair2.publicKey}`);
    console.log('✅ Test 2 passed: Different keypairs generated\n');

    // Test 3: Verify KeypairResult interface structure
    console.log('📝 Test 3: Testing KeypairResult interface structure...');
    const keypair3 = generateKeypair();
    
    // Verify the object has the expected properties
    if (!keypair3.publicKey || !keypair3.secretKey) {
      throw new Error('KeypairResult missing required properties');
    }
    
    // Verify the types
    if (typeof keypair3.publicKey !== 'string' || typeof keypair3.secretKey !== 'string') {
      throw new Error('KeypairResult properties are not strings');
    }
    
    console.log('✅ Test 3 passed: Correct interface structure\n');

    console.log('🎉 All keypair tests passed successfully!');
    console.log('✅ Keypair generation utility is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

testKeypairGeneration();
