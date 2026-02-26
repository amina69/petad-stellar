#!/usr/bin/env node

import { TransactionStatusChecker } from './services/transaction-status.service.js';
import { Config } from './config.js';
import { StellarService } from './stellar-service.js';
import * as StellarSdk from '@stellar/stellar-sdk';

async function demonstrateTransactionStatusChecker() {
  console.log('🚀 Transaction Status Checker Demo\n');
  console.log('This demo shows the transaction status checker capabilities.\n');

  try {
    // Initialize services
    const config = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    const statusChecker = new TransactionStatusChecker(config);
    const stellarService = new StellarService(config);

    console.log('📝 Step 1: Creating test account...');
    const account = await stellarService.createAccount();
    console.log(`   ✅ Account created: ${account.publicKey}\n`);

    console.log('📝 Step 2: Building payment transaction...');
    const destination = await stellarService.createAccount();
    console.log(`   ✅ Destination account created: ${destination.publicKey}`);
    
    const transaction = await stellarService.buildPaymentTransaction(
      account.secretKey,
      destination.publicKey,
      '1.0'
    );
    console.log('   ✅ Transaction built\n');

    console.log('📝 Step 3: Submitting transaction...');
    const submitResult = await stellarService.submitTransaction(transaction);
    console.log(`   ✅ Transaction submitted`);
    console.log(`   Hash: ${submitResult.hash}\n`);

    console.log('📝 Step 4: Checking transaction status (immediate)...');
    const immediateStatus = await statusChecker.getTransactionByHash(submitResult.hash);
    console.log(`   Confirmed: ${immediateStatus.confirmed}`);
    if (immediateStatus.confirmed) {
      console.log(`   Ledger: ${immediateStatus.ledger}`);
      console.log(`   Timestamp: ${immediateStatus.timestamp}`);
      console.log(`   Successful: ${immediateStatus.successful}\n`);
    } else {
      console.log(`   Status: Pending confirmation\n`);
    }

    console.log('📝 Step 5: Polling for confirmation...');
    const pollingStatus = await statusChecker.pollForConfirmation(submitResult.hash, {
      maxAttempts: 20,
      intervalMs: 1000,
      timeoutMs: 30000,
    });
    console.log(`   ✅ Transaction confirmed!`);
    console.log(`   Ledger: ${pollingStatus.ledger}`);
    console.log(`   Timestamp: ${pollingStatus.timestamp}`);
    console.log(`   Successful: ${pollingStatus.successful}\n`);

    console.log('📝 Step 6: Verifying ledger inclusion...');
    const isIncluded = await statusChecker.verifyLedgerInclusion(submitResult.hash);
    console.log(`   ✅ Ledger inclusion verified: ${isIncluded}\n`);

    console.log('📝 Step 7: Testing with non-existent transaction...');
    const fakeHash = 'a'.repeat(64);
    const fakeStatus = await statusChecker.getTransactionByHash(fakeHash);
    console.log(`   Confirmed: ${fakeStatus.confirmed}`);
    console.log(`   Error: ${fakeStatus.error}\n`);

    console.log('═'.repeat(50));
    console.log('🎉 Demo completed successfully!');
    console.log('═'.repeat(50));
    console.log('\n📊 Summary:');
    console.log('   ✅ Transaction submission');
    console.log('   ✅ Immediate status check');
    console.log('   ✅ Confirmation polling');
    console.log('   ✅ Ledger inclusion verification');
    console.log('   ✅ Error handling for non-existent transactions');
    console.log('\n🔍 View transaction on Horizon:');
    console.log(`   ${config.getHorizonUrl()}/transactions/${submitResult.hash}`);

  } catch (error) {
    console.error('\n❌ Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error) {
      if (error.message.includes('friendbot')) {
        console.log('\n💡 Tip: Testnet friendbot might be temporarily unavailable. Try again in a moment.');
      } else if (error.message.includes('timeout')) {
        console.log('\n💡 Tip: Transaction confirmation timed out. The network might be slow.');
      } else if (error.message.includes('Horizon unavailable')) {
        console.log('\n💡 Tip: Horizon server is temporarily down. The service will retry automatically.');
      }
    }
    
    process.exit(1);
  }
}

// Run the demo
demonstrateTransactionStatusChecker();
