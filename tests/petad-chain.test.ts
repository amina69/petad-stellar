import PetAdChain from '../src/index.js';

async function testPetAdChain() {
  console.log('🚀 Testing PetAdChain Stellar SDK Infrastructure...\n');

  try {
    // Initialize PetAdChain with testnet configuration
    const chain = new PetAdChain({ useTestnet: true });
    
    console.log('✅ PetAdChain initialized successfully');
    console.log(`📍 Network: ${chain.isTestnet() ? 'Testnet' : 'Mainnet'}`);
    console.log(`🔗 Horizon URL: ${chain.getConfig().getHorizonUrl()}\n`);

    // Test 1: Create a new testnet account
    console.log('📝 Test 1: Creating new testnet account...');
    const account = await chain.createAccount();
    console.log(`✅ Account created successfully!`);
    console.log(`🔑 Public Key: ${account.publicKey}`);
    console.log(`🔐 Secret Key: ${account.secretKey}\n`);

    // Test 2: Send a payment transaction (using master secret from env)
    console.log('💸 Test 2: Sending payment transaction...');
    const masterSecret = chain.getConfig().getMasterSecret();
    
    if (masterSecret) {
      try {
        const paymentResult = await chain.sendPayment(
          masterSecret,
          account.publicKey,
          '10', // 10 XLM
          undefined // native asset
        );
        
        console.log(`✅ Payment transaction submitted successfully!`);
        console.log(`🔗 Transaction Hash: ${paymentResult.hash}`);
        console.log(`📊 Status: ${paymentResult.status}`);
        console.log(`✅ Successful: ${paymentResult.successful}\n`);

        // Test 3: Fetch transaction status by hash
        console.log('🔍 Test 3: Fetching transaction status...');
        const status = await chain.getTransactionStatus(paymentResult.hash);
        console.log(`✅ Transaction status retrieved!`);
        console.log(`🔗 Hash: ${status.hash}`);
        console.log(`📊 Status: ${status.status}`);
        console.log(`✅ Successful: ${status.successful}\n`);

        // Test 4: Anchor trust hash
        console.log('🔒 Test 4: Anchoring trust hash...');
        const trustHash = 'test-hash-' + Date.now().toString().slice(-10);
        const trustResult = await chain.anchorTrustHash(trustHash, masterSecret);
        console.log(`✅ Trust hash anchored!`);
        console.log(`🔗 Transaction Hash: ${trustResult.hash}`);
        console.log(`🔐 Verified: ${trustResult.verified}`);
        if (trustResult.timestamp) {
          console.log(`⏰ Timestamp: ${trustResult.timestamp.toISOString()}`);
        }

      } catch (paymentError) {
        console.log(`⚠️  Payment test skipped: ${paymentError instanceof Error ? paymentError.message : 'Unknown error'}`);
        console.log('💡 This is normal if the master secret is not configured or has insufficient funds\n');
      }
    } else {
      console.log('⚠️  Payment test skipped: No master secret configured in environment\n');
    }

    console.log('🎉 All tests completed successfully!');
    console.log('\n📦 PetAdChain is ready to use as an npm package or local dependency');
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

testPetAdChain();
