import { TransactionStatusChecker } from './services/transaction-status.service.js';
import { Config } from './config.js';
import { StellarService } from './stellar-service.js';
import * as StellarSdk from '@stellar/stellar-sdk';

async function runTests() {
  console.log('🧪 Running Transaction Status Checker Tests\n');

  const config = Config.getInstance({
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  });

  const statusChecker = new TransactionStatusChecker(config);
  const stellarService = new StellarService(config);

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: Get transaction by hash
  try {
    console.log('📝 Test 1: Retrieve confirmed transaction details');
    
    const account = await stellarService.createAccount();
    const transaction = await stellarService.buildPaymentTransaction(
      account.secretKey,
      StellarSdk.Keypair.random().publicKey(),
      '1.0'
    );

    const result = await stellarService.submitTransaction(transaction);
    console.log(`   Transaction submitted: ${result.hash}`);

    // Wait for ledger inclusion
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const status = await statusChecker.getTransactionByHash(result.hash);

    if (status.confirmed && status.ledger && status.timestamp && status.successful) {
      console.log('   ✅ PASSED - Transaction confirmed with ledger and timestamp\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED - Transaction not properly confirmed\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Test 2: Non-existent transaction
  try {
    console.log('📝 Test 2: Handle non-existent transaction');
    
    const fakeHash = 'a'.repeat(64);
    const status = await statusChecker.getTransactionByHash(fakeHash);

    if (!status.confirmed && status.error) {
      console.log('   ✅ PASSED - Correctly returned not confirmed\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED - Should return not confirmed\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Test 3: Poll for confirmation
  try {
    console.log('📝 Test 3: Poll for transaction confirmation');
    
    const account = await stellarService.createAccount();
    const transaction = await stellarService.buildPaymentTransaction(
      account.secretKey,
      StellarSdk.Keypair.random().publicKey(),
      '0.5'
    );

    const submitResult = await stellarService.submitTransaction(transaction);
    console.log(`   Transaction submitted: ${submitResult.hash}`);

    const status = await statusChecker.pollForConfirmation(submitResult.hash, {
      maxAttempts: 20,
      intervalMs: 1000,
      timeoutMs: 30000,
    });

    if (status.confirmed && status.ledger && status.timestamp) {
      console.log('   ✅ PASSED - Polling confirmed transaction\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED - Polling did not confirm transaction\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Test 4: Verify ledger inclusion
  try {
    console.log('📝 Test 4: Verify ledger inclusion');
    
    const account = await stellarService.createAccount();
    const transaction = await stellarService.buildPaymentTransaction(
      account.secretKey,
      StellarSdk.Keypair.random().publicKey(),
      '0.2'
    );

    const result = await stellarService.submitTransaction(transaction);
    console.log(`   Transaction submitted: ${result.hash}`);

    // Wait for ledger inclusion
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const isIncluded = await statusChecker.verifyLedgerInclusion(result.hash);

    if (isIncluded) {
      console.log('   ✅ PASSED - Ledger inclusion verified\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED - Ledger inclusion not verified\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Test 5: Submit and wait for confirmation
  try {
    console.log('📝 Test 5: Submit and wait for confirmation');
    
    const account = await stellarService.createAccount();
    const transaction = await stellarService.buildPaymentTransaction(
      account.secretKey,
      StellarSdk.Keypair.random().publicKey(),
      '0.4'
    );

    const status = await statusChecker.submitAndWaitForConfirmation(transaction, {
      maxAttempts: 20,
      intervalMs: 1000,
    });

    if (status.confirmed && status.successful && status.ledger && status.timestamp) {
      console.log('   ✅ PASSED - Submit and wait successful\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED - Submit and wait did not confirm\n');
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Test 6: Timeout handling
  try {
    console.log('📝 Test 6: Timeout handling');
    
    const fakeHash = 'b'.repeat(64);
    
    try {
      await statusChecker.pollForConfirmation(fakeHash, {
        maxAttempts: 3,
        intervalMs: 500,
        timeoutMs: 2000,
      });
      console.log('   ❌ FAILED - Should have thrown timeout error\n');
      failedTests++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('   ✅ PASSED - Timeout handled correctly\n');
        passedTests++;
      } else {
        console.log('   ❌ FAILED - Wrong error type\n');
        failedTests++;
      }
    }
  } catch (error) {
    console.log(`   ❌ FAILED - ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    failedTests++;
  }

  // Summary
  console.log('═'.repeat(50));
  console.log(`📊 Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('═'.repeat(50));

  if (failedTests === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
