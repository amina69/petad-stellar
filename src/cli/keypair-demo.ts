#!/usr/bin/env node

import { generateKeypair } from '../accounts/keypair.js';

async function demoKeypairGeneration() {
  console.log('🔑 PetAdChain Keypair Generation Demo\n');
  
  try {
    // Generate a new keypair
    const keypair = generateKeypair();
    
    console.log('✅ Generated new Stellar keypair:');
    console.log(`🔑 Public Key: ${keypair.publicKey}`);
    console.log(`🔐 Secret Key: ${keypair.secretKey}`);
    console.log();
    
    console.log('⚠️  SECURITY WARNING:');
    console.log('   - Never share or log your secret key');
    console.log('   - Store the secret key securely (e.g., in environment variables)');
    console.log('   - Anyone with the secret key has full control of the account');
    console.log();
    
    console.log('📚 Usage Example:');
    console.log('```javascript');
    console.log('import { generateKeypair } from "petad-chain";');
    console.log();
    console.log('const keypair = generateKeypair();');
    console.log('console.log(keypair.publicKey); // G...');
    console.log('console.log(keypair.secretKey); // S...');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

demoKeypairGeneration();
