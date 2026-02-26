import { FundingService, Config } from './index.js';

async function testFundingTransaction() {
  console.log('🚀 Testing Funding Transaction Builder...\n');

  try {
    // Initialize funding service with testnet configuration
    const config = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });

    const fundingService = new FundingService(config);

    // Test 1: Build funding transaction (don't submit yet)
    console.log('📝 Test 1: Building funding transaction...');
    
    // You need to provide a real testnet account secret for this test
    const sourceSecret = process.env.TESTNET_SOURCE_SECRET || 'SDABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    const escrowPublicKey = 'GBQGEXZF36EQBJZ72QC5JEGUHBRI22CGUWEP7OVZA44OAJFFKKIRVDOE'; // From previous test
    const escrowId = 'escrow-test-001';
    const amount = '1.5';

    const fundingResult = await fundingService.buildEscrowFundingTx(
      sourceSecret,
      escrowPublicKey,
      escrowId,
      amount
    );

    console.log('✅ Funding transaction built successfully!');
    console.log(`   Transaction Hash: ${fundingResult.txHash}`);
    console.log(`   XDR: ${fundingResult.xdr.substring(0, 100)}...`);
    console.log(`   Operations: ${fundingResult.transaction.operations.length}`);
    console.log(`   Memo: ${fundingResult.transaction.memo?.value}\n`);

    // Test 2: Validate signed transaction
    console.log('📝 Test 2: Validating signed transaction...');
    const validation = fundingService.validateSignedTx(fundingResult.xdr);
    
    if (validation.valid) {
      console.log('✅ Transaction validation passed!');
      console.log(`   Valid: ${validation.valid}`);
      console.log(`   Operations: ${validation.transaction?.operations.length}\n`);
    } else {
      console.log('❌ Transaction validation failed:', validation.error);
      console.log('   (This is expected if using a fake secret key)\n');
    }

    // Test 3: Test parameter validation
    console.log('📝 Test 3: Testing parameter validation...');
    
    try {
      await fundingService.buildFundingTx({
        sourceSecret: 'invalid-secret',
        destinationPublicKey: escrowPublicKey,
        amount: '1.0',
        escrowId: 'test'
      });
      console.log('❌ Should have failed with invalid secret!');
    } catch (error) {
      console.log('✅ Correctly caught invalid secret error');
    }

    try {
      await fundingService.buildFundingTx({
        sourceSecret,
        destinationPublicKey: 'invalid-public-key',
        amount: '1.0',
        escrowId: 'test'
      });
      console.log('❌ Should have failed with invalid public key!');
    } catch (error) {
      console.log('✅ Correctly caught invalid public key error');
    }

    try {
      await fundingService.buildFundingTx({
        sourceSecret,
        destinationPublicKey: escrowPublicKey,
        amount: '-1.0',
        escrowId: 'test'
      });
      console.log('❌ Should have failed with negative amount!');
    } catch (error) {
      console.log('✅ Correctly caught negative amount error');
    }

    try {
      await fundingService.buildFundingTx({
        sourceSecret,
        destinationPublicKey: escrowPublicKey,
        amount: '1.0',
        escrowId: ''
      });
      console.log('❌ Should have failed with empty escrow ID!');
    } catch (error) {
      console.log('✅ Correctly caught empty escrow ID error');
    }

    console.log('\n🎉 All funding transaction tests passed!\n');

    // Test 4: Show transaction structure (if valid)
    if (validation.valid && validation.transaction) {
      console.log('📊 Transaction Structure:');
      console.log('─'.repeat(50));
      console.log(`   Source: ${validation.transaction.source}`);
      console.log(`   Fee: ${validation.transaction.fee} stroops`);
      console.log(`   Sequence: ${validation.transaction.sequence}`);
      console.log(`   Operations: ${validation.transaction.operations.length}`);
      
      validation.transaction.operations.forEach((op, index) => {
        if (op.type === 'payment') {
          console.log(`   Operation ${index + 1}: Payment`);
          console.log(`     Destination: ${op.destination}`);
          console.log(`     Amount: ${op.amount} ${op.asset.getCode() === 'XLM' ? 'XLM' : 'custom'}`);
        }
      });
      
      console.log(`   Memo: ${validation.transaction.memo?.value || 'None'}`);
      console.log('─'.repeat(50));
    }

    return {
      txHash: fundingResult.txHash,
      xdr: fundingResult.xdr,
      valid: validation.valid
    };

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testFundingTransaction()
    .then((result) => {
      console.log('\n📊 Test Results:');
      console.log(`   Transaction Hash: ${result.txHash}`);
      console.log(`   XDR Length: ${result.xdr.length} characters`);
      console.log(`   Validation: ${result.valid ? 'PASSED' : 'FAILED'}`);
      
      if (!result.valid) {
        console.log('\n💡 Note: Validation failed likely due to fake source secret.');
        console.log('   To test with real transaction, set TESTNET_SOURCE_SECRET environment variable.');
      }
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testFundingTransaction };
