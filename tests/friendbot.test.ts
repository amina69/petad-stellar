import { fundTestnetAccount, FriendbotError } from '../src/accounts/friendbot.js';
import { generateKeypair } from '../src/accounts/keypair.js';

async function testFriendbotFunding() {
  console.log('🤖 Testing Friendbot Funding...\n');

  try {
    // Test 1: Invalid public key validation
    console.log('📝 Test 1: Invalid public key validation...');
    try {
      await fundTestnetAccount('invalid-key');
      throw new Error('Should have thrown error for invalid public key');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid public key format')) {
        console.log('✅ Test 1 passed: Invalid public key rejected');
      } else {
        throw error;
      }
    }

    // Test 2: Mainnet guard
    console.log('📝 Test 2: Mainnet guard...');
    const originalNetwork = process.env['STELLAR_NETWORK'];
    process.env['STELLAR_NETWORK'] = 'public';

    try {
      const validKey = generateKeypair().publicKey;
      await fundTestnetAccount(validKey);
      throw new Error('Should have thrown error for mainnet');
    } catch (error) {
      if (error instanceof Error && error.message.includes('only available on testnet')) {
        console.log('✅ Test 2 passed: Mainnet guard active');
      } else {
        throw error;
      }
    } finally {
      process.env['STELLAR_NETWORK'] = originalNetwork ?? 'testnet';
    }

    // Test 3: Valid public key format (without actually calling friendbot)
    console.log('📝 Test 3: Valid public key format...');
    const validKey = generateKeypair().publicKey;

    try {
      await fundTestnetAccount(validKey);
    } catch (error) {
      if (error instanceof FriendbotError && error.message.includes('Network error')) {
        console.log('✅ Test 3 passed: Valid public key accepted (network error expected)');
      } else if (error instanceof Error && !error.message.includes('Invalid public key') && !error.message.includes('only available on testnet')) {
        console.log('✅ Test 3 passed: Valid public key format accepted');
      } else {
        throw error;
      }
    }

    // Test 4: FriendbotError class
    console.log('📝 Test 4: FriendbotError class...');
    const error = new FriendbotError('Test error', 500);

    if (error.name === 'FriendbotError' && error.message === 'Test error' && error.statusCode === 500) {
      console.log('✅ Test 4 passed: FriendbotError class working correctly');
    } else {
      throw new Error('FriendbotError class not working correctly');
    }

    console.log('\n🎉 All friendbot tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

testFriendbotFunding();
