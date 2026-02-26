#!/usr/bin/env node

import { TransactionStatusChecker } from '../services/transaction-status.service.js';
import { Config } from '../config.js';

interface CheckStatusOptions {
  txHash: string;
  testnet?: boolean;
  poll?: boolean;
  maxAttempts?: number;
  intervalMs?: number;
  timeoutMs?: number;
}

async function checkTransactionStatus(options: CheckStatusOptions) {
  const {
    txHash,
    testnet = true,
    poll = false,
    maxAttempts = 30,
    intervalMs = 2000,
    timeoutMs = 60000,
  } = options;

  console.log('🔍 Checking Transaction Status\n');

  try {
    // Configure for testnet or mainnet
    const config = Config.getInstance({
      horizonUrl: testnet
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org',
      networkPassphrase: testnet
        ? 'Test SDF Network ; September 2015'
        : 'Public Global Stellar Network ; September 2015',
    });

    const statusChecker = new TransactionStatusChecker(config);

    console.log(`🌐 Network: ${testnet ? 'Testnet' : 'Mainnet'}`);
    console.log(`🔗 Transaction Hash: ${txHash}`);
    console.log(`🔄 Mode: ${poll ? 'Polling' : 'Single Check'}\n`);

    if (poll) {
      console.log(`⏳ Polling for confirmation...`);
      console.log(`   Max Attempts: ${maxAttempts}`);
      console.log(`   Interval: ${intervalMs}ms`);
      console.log(`   Timeout: ${timeoutMs}ms\n`);
    }

    const startTime = Date.now();

    // Check or poll for transaction status
    const result = poll
      ? await statusChecker.pollForConfirmation(txHash, {
          maxAttempts,
          intervalMs,
          timeoutMs,
        })
      : await statusChecker.getTransactionByHash(txHash);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Display results
    console.log('📊 Transaction Status:');
    console.log('─'.repeat(50));
    console.log(`✅ Confirmed: ${result.confirmed ? 'Yes' : 'No'}`);

    if (result.confirmed) {
      console.log(`📗 Ledger: ${result.ledger}`);
      console.log(`⏰ Timestamp: ${result.timestamp}`);
      console.log(`✔️  Successful: ${result.successful ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Error: ${result.error || 'Not confirmed'}`);
    }

    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('─'.repeat(50));

    // Provide Horizon explorer link
    const explorerUrl = `${config.getHorizonUrl()}/transactions/${txHash}`;
    console.log(`\n🔍 View on Horizon Explorer:`);
    console.log(`${explorerUrl}`);

    // Verify ledger inclusion
    if (result.confirmed) {
      console.log(`\n🔐 Verifying ledger inclusion...`);
      const isIncluded = await statusChecker.verifyLedgerInclusion(txHash);
      console.log(`✅ Ledger Inclusion: ${isIncluded ? 'Verified' : 'Failed'}`);
    }

    return result;
  } catch (error) {
    console.error(
      '❌ Failed to check transaction status:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    if (error instanceof Error && error.message.includes('timeout')) {
      console.log(
        '\n💡 Transaction confirmation timed out. Try increasing --timeout or --max-attempts'
      );
    }

    if (error instanceof Error && error.message.includes('Horizon unavailable')) {
      console.log(
        '\n💡 Horizon server is temporarily unavailable. Please try again later.'
      );
    }

    process.exit(1);
  }
}

// CLI argument parsing
function parseArgs(): CheckStatusOptions {
  const args = process.argv.slice(2);
  const options: CheckStatusOptions = {} as CheckStatusOptions;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--hash':
      case '-h':
        const hashArg = args[++i];
        if (hashArg) {
          options.txHash = hashArg;
        }
        break;
      case '--mainnet':
        options.testnet = false;
        break;
      case '--poll':
      case '-p':
        options.poll = true;
        break;
      case '--max-attempts':
      case '-m':
        const attemptsArg = args[++i];
        if (attemptsArg) {
          options.maxAttempts = parseInt(attemptsArg, 10);
        }
        break;
      case '--interval':
      case '-i':
        const intervalArg = args[++i];
        if (intervalArg) {
          options.intervalMs = parseInt(intervalArg, 10);
        }
        break;
      case '--timeout':
      case '-t':
        const timeoutArg = args[++i];
        if (timeoutArg) {
          options.timeoutMs = parseInt(timeoutArg, 10);
        }
        break;
      case '--help':
        console.log(`
Stellar Transaction Status Checker

Usage: npm run check-status [options]

Required Options:
  --hash, -h <hash>           Transaction hash to check

Optional Options:
  --mainnet                   Use mainnet instead of testnet
  --poll, -p                  Poll for confirmation instead of single check
  --max-attempts, -m <num>    Maximum polling attempts (default: 30)
  --interval, -i <ms>         Polling interval in milliseconds (default: 2000)
  --timeout, -t <ms>          Polling timeout in milliseconds (default: 60000)
  --help                      Show this help message

Examples:
  # Single check
  npm run check-status --hash abc123...

  # Poll for confirmation
  npm run check-status --hash abc123... --poll

  # Custom polling parameters
  npm run check-status --hash abc123... --poll --max-attempts 50 --interval 1000

  # Check mainnet transaction
  npm run check-status --hash abc123... --mainnet
        `);
        process.exit(0);
    }
  }

  // Validate required arguments
  if (!options.txHash) {
    console.error('❌ Error: --hash is required');
    console.log('Run with --help for usage information');
    process.exit(1);
  }

  return options;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  checkTransactionStatus(options);
}

export { checkTransactionStatus };
