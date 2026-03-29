#!/usr/bin/env node

import { fundTestnetAccount, FriendbotError } from '../accounts/friendbot.js';
import { generateKeypair } from '../accounts/keypair.js';

async function demoFriendbotFunding() {
  console.log('🤖 PetAdChain Friendbot Funding Demo\n');
  
  try {
    // Generate a new keypair for demonstration
    const keypair = generateKeypair();
    
    console.log('✅ Generated new Stellar keypair:');
    console.log(`🔑 Public Key: ${keypair.publicKey}`);
    console.log(`🔐 Secret Key: ${keypair.secretKey.substring(0, 8)}... (truncated for security)`);
    console.log();
    
    console.log('📝 Attempting to fund account with Friendbot...');
    console.log('⚠️  This will only work on Stellar testnet');
    console.log();
    
    // Try to fund the account
    const result = await fundTestnetAccount(keypair.publicKey);
    
    if (result.funded) {
      console.log('🎉 Account successfully funded!');
      console.log(`💰 Amount: ${result.amount} XLM`);
      console.log('🔗 You can now use this account for testnet transactions');
    } else {
      console.log('⚠️  Account was not funded');
      if (result.reason === 'already_funded') {
        console.log('ℹ️  This account was already funded on testnet');
      } else {
        console.log(`❌ Reason: ${result.reason}`);
      }
    }
    
    console.log();
    console.log('📚 Usage Example:');
    console.log('```javascript');
    console.log('import { fundTestnetAccount } from "petad-chain";');
    console.log('import { generateKeypair } from "petad-chain";');
    console.log();
    console.log('const keypair = generateKeypair();');
    console.log('const result = await fundTestnetAccount(keypair.publicKey);');
    console.log('console.log(result.funded); // true or false');
    console.log('```');
    
  } catch (error) {
    if (error instanceof FriendbotError) {
      console.error('❌ Friendbot Error:', error.message);
      if (error.statusCode) {
        console.error(`🔗 Status Code: ${error.statusCode}`);
      }
    } else if (error instanceof Error) {
      console.error('❌ Error:', error.message);
    } else {
      console.error('❌ Unknown error occurred');
    }
    
    console.log();
    console.log('💡 Troubleshooting:');
    console.log('   - Ensure you are on testnet network');
    console.log('   - Check your internet connection');
    console.log('   - Verify the friendbot service is available');
  }
}

demoFriendbotFunding();
