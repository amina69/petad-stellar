import { EncryptionUtils } from '../src/utils/encryption.utils.js';

/**
 * Test suite for encryption utilities
 * Tests AES-256-GCM encryption/decryption functionality
 */
async function runEncryptionTests() {
    console.log('🔐 Encryption Utilities Test Suite');
    console.log('='.repeat(50));

    let testsPassed = 0;
    let testsTotal = 0;

    function test(name: string, testFn: () => boolean) {
        testsTotal++;
        try {
            const result = testFn();
            if (result) {
                console.log(`✅ ${name}`);
                testsPassed++;
            } else {
                console.log(`❌ ${name} - Test returned false`);
            }
        } catch (error) {
            console.log(`❌ ${name} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Test 1: Basic encryption/decryption
    test('Basic encryption/decryption', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const key = 'test-encryption-key-123';
        
        const encrypted = EncryptionUtils.encryptSecret(secret, key);
        const decrypted = EncryptionUtils.decryptSecret(encrypted, key);
        
        return secret === decrypted;
    });

    // Test 2: Different keys produce different results
    test('Different keys produce different ciphertexts', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const key1 = 'key-1';
        const key2 = 'key-2';
        
        const encrypted1 = EncryptionUtils.encryptSecret(secret, key1);
        const encrypted2 = EncryptionUtils.encryptSecret(secret, key2);
        
        return encrypted1 !== encrypted2;
    });

    // Test 3: Same key produces different ciphertexts (due to random IV)
    test('Same key produces different ciphertexts (random IV)', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const key = 'test-key';
        
        const encrypted1 = EncryptionUtils.encryptSecret(secret, key);
        const encrypted2 = EncryptionUtils.encryptSecret(secret, key);
        
        return encrypted1 !== encrypted2;
    });

    // Test 4: Wrong key fails to decrypt
    test('Wrong key fails to decrypt', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const correctKey = 'correct-key';
        const wrongKey = 'wrong-key';
        
        const encrypted = EncryptionUtils.encryptSecret(secret, correctKey);
        
        try {
            EncryptionUtils.decryptSecret(encrypted, wrongKey);
            return false; // Should have failed
        } catch (error) {
            return error instanceof Error && error.message.includes('Failed to decrypt');
        }
    });

    // Test 5: Empty inputs are rejected
    test('Empty inputs are rejected', () => {
        try {
            EncryptionUtils.encryptSecret('', 'key');
            return false;
        } catch {
            // Expected
        }
        
        try {
            EncryptionUtils.encryptSecret('secret', '');
            return false;
        } catch {
            // Expected
        }
        
        try {
            EncryptionUtils.decryptSecret('', 'key');
            return false;
        } catch {
            // Expected
        }
        
        try {
            EncryptionUtils.decryptSecret('data', '');
            return false;
        } catch {
            // Expected
        }
        
        return true;
    });

    // Test 6: Deterministic key generation
    test('Deterministic key generation', () => {
        const seed = 'test-seed-123';
        const key1 = EncryptionUtils.generateEncryptionKey(seed);
        const key2 = EncryptionUtils.generateEncryptionKey(seed);
        
        return key1 === key2 && key1.length === 64; // SHA-256 hex = 64 chars
    });

    // Test 7: Different seeds produce different keys
    test('Different seeds produce different keys', () => {
        const key1 = EncryptionUtils.generateEncryptionKey('seed-1');
        const key2 = EncryptionUtils.generateEncryptionKey('seed-2');
        
        return key1 !== key2;
    });

    // Test 8: Encrypted format validation
    test('Encrypted format validation', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const key = 'test-key';
        
        const validEncrypted = EncryptionUtils.encryptSecret(secret, key);
        const isValid = EncryptionUtils.isValidEncryptedFormat(validEncrypted);
        
        // Test invalid formats
        const invalidInputs = [
            '',
            'not-base64',
            'dGVzdA==', // Too short base64
            null as any,
            undefined as any,
            123 as any
        ];
        
        const allInvalid = invalidInputs.every(input => !EncryptionUtils.isValidEncryptedFormat(input));
        
        return isValid && allInvalid;
    });

    // Test 9: Logging sanitization
    test('Logging sanitization', () => {
        const longEncrypted = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const sanitized = EncryptionUtils.sanitizeForLogging(longEncrypted, 10);
        
        return sanitized === 'ABCDEFGHIJ...' && 
               EncryptionUtils.sanitizeForLogging('', 20) === '[EMPTY]';
    });

    // Test 10: Large secret handling
    test('Large secret handling', () => {
        const largeSecret = 'S'.repeat(1000); // 1000 character secret
        const key = 'test-key';
        
        const encrypted = EncryptionUtils.encryptSecret(largeSecret, key);
        const decrypted = EncryptionUtils.decryptSecret(encrypted, key);
        
        return largeSecret === decrypted;
    });

    // Test 11: Corrupted data detection
    test('Corrupted data detection', () => {
        const secret = 'SBABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
        const key = 'test-key';
        
        const encrypted = EncryptionUtils.encryptSecret(secret, key);
        
        // Corrupt the base64 string
        const corrupted = encrypted.slice(0, -5) + 'XXXXX';
        
        try {
            EncryptionUtils.decryptSecret(corrupted, key);
            return false; // Should have failed
        } catch (error) {
            return error instanceof Error && error.message.includes('Failed to decrypt');
        }
    });

    // Test 12: Integration with Stellar keypair format
    test('Stellar keypair format compatibility', () => {
        // Test with actual Stellar secret key format
        const stellarSecrets = [
            'SB2WOZYD2JI2RL3BMZGJVXK5LVOZ2KMOJYGGGEZB5F2X6OBNAF4FQJRA',
            'SD7MEWJL5CFFCO5OQHLYT6LZYOJZIRJRS5AEU2YAHFCKL34HJXRG3PHQ',
            'SAV5EYFPZG2JAIQ5KQ5LJAFZ5UEJG2RQZ2J5J5J5J5J5J5J5J5J5J5J5J5J5'
        ];
        
        const key = 'stellar-test-key';
        
        return stellarSecrets.every(secret => {
            try {
                const encrypted = EncryptionUtils.encryptSecret(secret, key);
                const decrypted = EncryptionUtils.decryptSecret(encrypted, key);
                return secret === decrypted;
            } catch {
                return false;
            }
        });
    });

    console.log('\n📊 Test Results:');
    console.log(`Passed: ${testsPassed}/${testsTotal}`);
    console.log(`Success Rate: ${((testsPassed / testsTotal) * 100).toFixed(1)}%`);

    if (testsPassed === testsTotal) {
        console.log('🎉 All encryption tests passed!');
        return true;
    } else {
        console.log('❌ Some tests failed. Review the implementation.');
        return false;
    }
}

// Run the tests
runEncryptionTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
