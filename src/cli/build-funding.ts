#!/usr/bin/env node

import { FundingService, Config } from '../index.js';

interface BuildFundingOptions {
  sourceSecret?: string;
  destinationPublicKey?: string;
  amount?: string;
  escrowId?: string;
  testnet?: boolean;
  submit?: boolean;
}

async function buildFundingTransaction(options: BuildFundingOptions = {}) {
  const {
    sourceSecret = process.env.SOURCE_SECRET,
    destinationPublicKey = process.env.DESTINATION_PUBLIC_KEY,
    amount = process.env.FUNDING_AMOUNT || '2.0',
    escrowId = process.env.ESCROW_ID || 'escrow-' + Date.now(),
    testnet = true,
    submit = false
  } = options;

  console.log('🏗️  Building Stellar Funding Transaction\n');

  try {
    // Configure for testnet or mainnet
    const config = Config.getInstance({
      horizonUrl: testnet ? 'https://horizon-testnet.stellar.org' : 'https://horizon.stellar.org',
      networkPassphrase: testnet 
        ? 'Test SDF Network ; September 2015' 
        : 'Public Global Stellar Network ; September 2015'
    });

    const fundingService = new FundingService(config);

    console.log(`🌐 Network: ${testnet ? 'Testnet' : 'Mainnet'}`);
    console.log(`🔑 Source Secret: ${sourceSecret ? 'Provided' : 'Not provided - set SOURCE_SECRET'}`);
    console.log(`🎯 Destination: ${destinationPublicKey || 'Not provided - set DESTINATION_PUBLIC_KEY'}`);
    console.log(`💰 Amount: ${amount} XLM`);
    console.log(`🏷️  Escrow ID: ${escrowId}`);
    console.log(`📤 Submit: ${submit ? 'Yes' : 'No (build only)'}\n`);

    // Validate required parameters
    if (!sourceSecret) {
      throw new Error('Source secret is required. Set SOURCE_SECRET environment variable or use --secret option');
    }

    if (!destinationPublicKey) {
      throw new Error('Destination public key is required. Set DESTINATION_PUBLIC_KEY environment variable or use --destination option');
    }

    // Build funding transaction
    console.log('⏳ Building funding transaction...');
    const startTime = Date.now();

    const result = await fundingService.buildEscrowFundingTx(
      sourceSecret,
      destinationPublicKey,
      escrowId,
      amount
    );

    const endTime = Date.now();
    console.log(`✅ Transaction built in ${endTime - startTime}ms\n`);

    // Display results
    console.log('📊 Transaction Details:');
    console.log('─'.repeat(50));
    console.log(`🔗 Transaction Hash: ${result.txHash}`);
    console.log(`📄 XDR: ${result.xdr}`);
    console.log('─'.repeat(50));

    // Show transaction structure
    console.log(`\n📋 Transaction Structure:`);
    console.log(`   Source: ${result.transaction.source}`);
    console.log(`   Fee: ${result.transaction.fee} stroops`);
    console.log(`   Sequence: ${result.transaction.sequence}`);
    console.log(`   Operations: ${result.transaction.operations.length}`);

    result.transaction.operations.forEach((op, index) => {
      if (op.type === 'payment') {
        console.log(`   Operation ${index + 1}: Payment`);
        console.log(`     Destination: ${op.destination}`);
        console.log(`     Amount: ${op.amount} XLM`);
      }
    });

    console.log(`   Memo: ${result.transaction.memo?.value || 'None'}`);

    // Validate transaction
    console.log(`\n🔍 Validating transaction...`);
    const validation = fundingService.validateSignedTx(result.xdr);
    
    if (validation.valid) {
      console.log('✅ Transaction is valid and properly signed');
    } else {
      console.log(`❌ Transaction validation failed: ${validation.error}`);
    }

    // Submit if requested
    if (submit && validation.valid) {
      console.log(`\n📤 Submitting transaction to network...`);
      try {
        const submissionResult = await fundingService.submitTx(result.transaction);
        
        if (submissionResult.successful) {
          console.log('✅ Transaction submitted successfully!');
          console.log(`   Hash: ${submissionResult.hash}`);
          console.log(`   Status: ${submissionResult.status}`);
        } else {
          console.log('❌ Transaction submission failed');
          console.log(`   Status: ${submissionResult.status}`);
        }
      } catch (error) {
        console.log('❌ Submission error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Provide instructions
    console.log(`\n📝 Usage Instructions:`);
    console.log(`// To submit this transaction programmatically:`);
    console.log(`const fundingService = new FundingService();`);
    console.log(`const result = await fundingService.submitTxFromXDR('${result.xdr}');`);

    if (!submit) {
      console.log(`\n// To submit via CLI:`);
      console.log(`npm run submit-funding --xdr "${result.xdr.substring(0, 50)}..."`);
    }

    return result;

  } catch (error) {
    console.error('❌ Failed to build funding transaction:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('Source secret')) {
      console.log('\n💡 Solution: Set SOURCE_SECRET environment variable or use --secret option');
    }
    
    if (error instanceof Error && error.message.includes('Destination public key')) {
      console.log('\n💡 Solution: Set DESTINATION_PUBLIC_KEY environment variable or use --destination option');
    }
    
    process.exit(1);
  }
}

// CLI argument parsing
function parseArgs(): BuildFundingOptions {
  const args = process.argv.slice(2);
  const options: BuildFundingOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--secret':
      case '-s':
        const secretArg = args[++i];
        if (secretArg) {
          options.sourceSecret = secretArg;
        }
        break;
      case '--destination':
      case '-d':
        const destArg = args[++i];
        if (destArg) {
          options.destinationPublicKey = destArg;
        }
        break;
      case '--amount':
      case '-a':
        const amountArg = args[++i];
        if (amountArg) {
          options.amount = amountArg;
        }
        break;
      case '--escrow-id':
      case '-e':
        const escrowArg = args[++i];
        if (escrowArg) {
          options.escrowId = escrowArg;
        }
        break;
      case '--mainnet':
        options.testnet = false;
        break;
      case '--submit':
        options.submit = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Stellar Funding Transaction Builder

Usage: npm run build-funding [options]

Options:
  --secret, -s <secret>        Source account secret key
  --destination, -d <public>     Destination public key
  --amount, -a <amount>         Funding amount (default: 2.0 XLM)
  --escrow-id, -e <id>        Escrow identifier (default: auto-generated)
  --mainnet                     Use mainnet instead of testnet
  --submit                      Submit transaction after building
  --help, -h                    Show this help message

Environment Variables:
  SOURCE_SECRET              Source account secret key
  DESTINATION_PUBLIC_KEY     Destination public key
  FUNDING_AMOUNT           Funding amount (default: 2.0)
  ESCROW_ID                Escrow identifier

Examples:
  # Build transaction (no submission)
  npm run build-funding
  
  # Build and submit transaction
  npm run build-funding --submit
  
  # Use custom parameters
  npm run build-funding --secret "S..." --destination "G..." --amount "5.0" --escrow-id "my-escrow-001"
        `);
        process.exit(0);
    }
  }

  return options;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  buildFundingTransaction(options);
}

export { buildFundingTransaction };
