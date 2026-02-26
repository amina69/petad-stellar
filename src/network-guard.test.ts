import { NetworkGuard, NetworkGuardError, NetworkType } from './guards/network.guard.js';
import { Config } from './config.js';

async function testNetworkGuards() {
  console.log('🧪 Testing Network Guards\n');

  // Test 1: Testnet-only guard should allow testnet
  console.log('Test 1: Testnet-only guard with testnet config');
  try {
    const testnetConfig = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });
    const guard = NetworkGuard.testnetOnly(testnetConfig);
    guard.validateTransactionSubmission();
    console.log('✅ PASS: Testnet transactions allowed\n');
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : error}\n`);
  }

  // Test 2: Testnet-only guard should block public network
  console.log('Test 2: Testnet-only guard with public network config');
  try {
    // Reset singleton for testing
    (Config as any).instance = null;
    const publicConfig = Config.getInstance({
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015'
    });
    const guard = NetworkGuard.testnetOnly(publicConfig);
    guard.validateTransactionSubmission();
    console.log('❌ FAIL: Should have thrown NetworkGuardError\n');
  } catch (error) {
    if (error instanceof NetworkGuardError) {
      console.log(`✅ PASS: Blocked public network - ${error.message}\n`);
    } else {
      console.log(`❌ FAIL: Wrong error type: ${error}\n`);
    }
  }

  // Test 3: Development mode should block public network
  console.log('Test 3: Development mode blocks public network');
  try {
    process.env.NODE_ENV = 'development';
    (Config as any).instance = null;
    const publicConfig = Config.getInstance({
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015'
    });
    const guard = NetworkGuard.withPublicConsent(publicConfig);
    guard.validateTransactionSubmission();
    console.log('❌ FAIL: Should have thrown NetworkGuardError\n');
  } catch (error) {
    if (error instanceof NetworkGuardError && error.message.includes('development mode')) {
      console.log(`✅ PASS: Blocked in development - ${error.message}\n`);
    } else {
      console.log(`❌ FAIL: Wrong error: ${error}\n`);
    }
  }

  // Test 4: Public network requires explicit consent
  console.log('Test 4: Public network requires ALLOW_PUBLIC_NETWORK=true');
  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PUBLIC_NETWORK = 'false';
    (Config as any).instance = null;
    const publicConfig = Config.getInstance({
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015'
    });
    const guard = NetworkGuard.withPublicConsent(publicConfig);
    guard.validateTransactionSubmission();
    console.log('❌ FAIL: Should have thrown NetworkGuardError\n');
  } catch (error) {
    if (error instanceof NetworkGuardError && error.message.includes('ALLOW_PUBLIC_NETWORK')) {
      console.log(`✅ PASS: Requires explicit consent - ${error.message}\n`);
    } else {
      console.log(`❌ FAIL: Wrong error: ${error}\n`);
    }
  }

  // Test 5: Public network allowed with explicit consent
  console.log('Test 5: Public network allowed with explicit consent');
  try {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PUBLIC_NETWORK = 'true';
    (Config as any).instance = null;
    const publicConfig = Config.getInstance({
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015'
    });
    const guard = NetworkGuard.withPublicConsent(publicConfig);
    guard.validateTransactionSubmission();
    console.log('✅ PASS: Public network allowed with consent\n');
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : error}\n`);
  }

  // Test 6: Network info retrieval
  console.log('Test 6: Network info retrieval');
  try {
    const testnetConfig = Config.getInstance({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    });
    const guard = new NetworkGuard(testnetConfig);
    const info = guard.getNetworkInfo();
    
    if (info.network === NetworkType.TESTNET && 
        info.horizonUrl.includes('testnet') &&
        guard.isTestnet() === true &&
        guard.isPublic() === false) {
      console.log('✅ PASS: Network info correct');
      console.log(`   Network: ${info.network}`);
      console.log(`   Horizon: ${info.horizonUrl}`);
      console.log(`   Development: ${info.isDevelopment}\n`);
    } else {
      console.log('❌ FAIL: Network info incorrect\n');
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error instanceof Error ? error.message : error}\n`);
  }

  // Test 7: Wrong network detection
  console.log('Test 7: Wrong network detection');
  try {
    (Config as any).instance = null;
    const publicConfig = Config.getInstance({
      horizonUrl: 'https://horizon.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015'
    });
    const guard = new NetworkGuard(publicConfig, {
      allowedNetwork: NetworkType.TESTNET,
      requireExplicitConsent: false,
      isDevelopment: false
    });
    guard.validateNetwork();
    console.log('❌ FAIL: Should have detected wrong network\n');
  } catch (error) {
    if (error instanceof NetworkGuardError && error.message.includes('only TESTNET is allowed')) {
      console.log(`✅ PASS: Wrong network detected - ${error.message}\n`);
    } else {
      console.log(`❌ FAIL: Wrong error: ${error}\n`);
    }
  }

  console.log('🏁 Network Guard Tests Complete\n');
}

// Run tests
testNetworkGuards().catch(console.error);
