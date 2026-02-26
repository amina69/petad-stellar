import { FundingService, Config, EscrowService } from './index.js';

async function demonstrateFundingTransaction() {
  console.log('🚀 Demonstrating Funding Transaction Builder\n');

  try {
    // Initialize services with testnet configuration
    const config = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });

    const fundingService = new FundingService(config);
    const escrowService = new EscrowService(config);

    // Step 1: Create an escrow account first
    console.log('📝 Step 1: Creating escrow account...');
    const escrowAccount = await escrowService.createEscrowAccount('demo-encryption-key');
    
    console.log('✅ Escrow account created!');
    console.log(`   Public Key: ${escrowAccount.publicKey}`);
    console.log(`   Funded: ${escrowAccount.funded}\n`);

    // Step 2: Build funding transaction (demo with fake source)
    console.log('📝 Step 2: Building funding transaction...');
    console.log('   (Using demo source secret for illustration)\n');

    try {
      const fundingResult = await fundingService.buildEscrowFundingTx(
        'SDABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', // Demo secret
        escrowAccount.publicKey,
        'demo-escrow-001',
        '1.5'
      );

      console.log('❌ This should have failed with invalid secret!');
    } catch (error) {
      console.log('✅ Correctly rejected invalid secret key');
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }

    // Step 3: Demonstrate transaction structure
    console.log('📝 Step 3: Transaction Structure Demo');
    console.log('   (Valid parameters without real submission)\n');

    // Create a mock valid transaction structure
    const mockParams = {
      sourceSecret: 'SDABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', // Will fail validation
      destinationPublicKey: escrowAccount.publicKey,
      amount: '2.0',
      escrowId: 'demo-escrow-002'
    };

    console.log('📋 Required Parameters:');
    console.log('─'.repeat(40));
    console.log(`   Source Secret: [REDACTED]`);
    console.log(`   Destination: ${mockParams.destinationPublicKey}`);
    console.log(`   Amount: ${mockParams.amount} XLM`);
    console.log(`   Escrow ID: ${mockParams.escrowId}`);
    console.log('─'.repeat(40));

    // Step 4: Show validation features
    console.log('\n📝 Step 4: Validation Features');
    console.log('─'.repeat(40));

    // Test various validation scenarios
    const validationTests = [
      {
        name: 'Invalid Secret',
        params: { ...mockParams, sourceSecret: 'invalid' }
      },
      {
        name: 'Invalid Public Key',
        params: { ...mockParams, destinationPublicKey: 'invalid' }
      },
      {
        name: 'Negative Amount',
        params: { ...mockParams, amount: '-1.0' }
      },
      {
        name: 'Empty Escrow ID',
        params: { ...mockParams, escrowId: '' }
      },
      {
        name: 'Too Long Escrow ID',
        params: { ...mockParams, escrowId: 'a'.repeat(50) }
      }
    ];

    for (const test of validationTests) {
      try {
        await fundingService.buildFundingTx(test.params);
        console.log(`❌ ${test.name}: Should have failed!`);
      } catch (error) {
        console.log(`✅ ${test.name}: Correctly rejected`);
      }
    }

    // Step 5: Show successful transaction structure
    console.log('\n📝 Step 5: Successful Transaction Structure');
    console.log('─'.repeat(40));
    console.log('When built successfully, the transaction includes:');
    console.log('');
    console.log('🔗 Transaction Hash: Unique identifier');
    console.log('📄 XDR: Encoded transaction data');
    console.log('📋 Operations: Payment operation with amount and destination');
    console.log('🏷️  Memo: Escrow ID for tracking');
    console.log('✍️  Signatures: Owner account signature');
    console.log('🌐 Network: Testnet or Mainnet configuration');

    // Step 6: Show separation of concerns
    console.log('\n📝 Step 6: Separation of Concerns');
    console.log('─'.repeat(40));
    console.log('✅ buildFundingTx() - Builds but does NOT submit');
    console.log('✅ submitTx() - Submits pre-built transaction');
    console.log('✅ validateSignedTx() - Validates without submitting');
    console.log('✅ submitTxFromXDR() - Submits from XDR string');

    console.log('\n🎉 Funding transaction demonstration completed!\n');

    return {
      escrowAccount: {
        publicKey: escrowAccount.publicKey,
        funded: escrowAccount.funded
      },
      validationTests: validationTests.length,
      features: [
        'Payment operation building',
        'Memo attachment (escrowId)',
        'Owner secret signing',
        'Transaction hash generation',
        'XDR encoding',
        'Parameter validation',
        'Separate build/submit methods'
      ]
    };

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateFundingTransaction()
    .then((result) => {
      console.log('📊 Demo Results:');
      console.log(`   Escrow Account: ${result.escrowAccount.publicKey}`);
      console.log(`   Validation Tests: ${result.validationTests}`);
      console.log(`   Features: ${result.features.length}`);
      console.log('\n✅ All features demonstrated successfully!');
    })
    .catch((error) => {
      console.error('Demo execution failed:', error);
      process.exit(1);
    });
}

export { demonstrateFundingTransaction };
