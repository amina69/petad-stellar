# Stellar Escrow Account Creation

This implementation provides dedicated escrow account creation functionality for the Stellar network, with secure secret key encryption and comprehensive validation.

## Features

✅ **Stellar Keypair Generation** - Creates cryptographically secure keypairs  
✅ **Minimum XLM Reserve Funding** - Automatically funds accounts with required minimum balance  
✅ **Secret Key Encryption** - AES-256-GCM encryption for secure secret storage  
✅ **Account Existence Validation** - Verifies accounts are created and funded  
✅ **Testnet Support** - Uses Friendbot for automatic testnet funding  
✅ **Mainnet Support** - Uses master account for mainnet funding  
✅ **Horizon API Integration** - Full compatibility with Stellar Horizon  

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Create Escrow Account (Testnet)

```bash
# Using environment variable for encryption key
ENCRYPTION_KEY="your-secret-key" npm run create-escrow

# Or use the test script with predefined key
npm run test-escrow
```

### Programmatic Usage

```typescript
import { EscrowService, Config } from './dist/index.js';

// Initialize service
const config = Config.getInstance({
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
});

const escrowService = new EscrowService(config);

// Create and validate escrow account
const result = await escrowService.createAndValidateEscrowAccount('your-encryption-key');

console.log('Public Key:', result.publicKey);
console.log('Encrypted Secret:', result.encryptedSecret);
console.log('Balance:', result.balance);
console.log('Exists:', result.exists);

// Decrypt secret when needed
const secret = escrowService.decryptSecret(result.encryptedSecret, 'your-encryption-key');
```

## API Reference

### EscrowService

#### `createEscrowAccount(encryptionKey?: string): Promise<EscrowAccountResult>`

Creates a new escrow account with encrypted secret key.

**Parameters:**
- `encryptionKey` - Optional encryption key (defaults to MASTER_SECRET env var)

**Returns:**
```typescript
{
  publicKey: string;      // Stellar public key
  encryptedSecret: string; // AES-256-GCM encrypted secret
  funded: boolean;       // Whether funding was successful
}
```

#### `createAndValidateEscrowAccount(encryptionKey?: string): Promise<EscrowAccountResult & AccountValidationResult>`

Creates an escrow account and validates its existence on the network.

**Additional Returns:**
```typescript
{
  exists: boolean;    // Account exists on network
  balance: string;    // XLM balance
  sequence: string;   // Account sequence number
}
```

#### `validateAccountExistence(publicKey: string): Promise<AccountValidationResult>`

Validates if an account exists on the Stellar network.

#### `decryptSecret(encryptedSecret: string, key?: string): string`

Decrypts an encrypted Stellar secret key.

#### `generateEncryptionKey(seed: string): string` (static)

Generates a deterministic encryption key from a seed.

## CLI Usage

### Basic Commands

```bash
# Create escrow account with default settings
npm run create-escrow

# Create with custom encryption key
npm run create-escrow --key "my-secret-key"

# Create on mainnet (requires MASTER_SECRET)
npm run create-escrow --mainnet --key "my-secret-key"

# Skip validation for faster creation
npm run create-escrow --no-validate

# Show help
npm run create-escrow --help
```

### Environment Variables

- `ENCRYPTION_KEY` - Default encryption key for secret encryption
- `MASTER_SECRET` - Master account secret for mainnet funding

## Security Features

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: SHA-256 hash of encryption key
- **IV**: 16-byte random initialization vector
- **Authentication**: GCM authentication tag for integrity

### Key Management

- Secrets are never stored in plaintext
- Encryption keys can be provided via environment variables
- Deterministic key generation available for reproducible results

## Testing

### Run Tests

```bash
# Run comprehensive test suite
npm run test

# Run test with predefined encryption key
npm run test-escrow
```

### Test Coverage

The test suite includes:
- ✅ Keypair generation
- ✅ Account funding (testnet via Friendbot)
- ✅ Secret encryption/decryption
- ✅ Account existence validation
- ✅ Wrong key error handling
- ✅ Deterministic key generation

## Network Support

### Testnet
- **Funding**: Automatic via Friendbot
- **Minimum Balance**: 10,000 XLM (Friendbot default)
- **Horizon URL**: `https://horizon-testnet.stellar.org`

### Mainnet
- **Funding**: Manual via master account
- **Minimum Balance**: 2 XLM (configurable)
- **Requirements**: MASTER_SECRET environment variable
- **Horizon URL**: `https://horizon.stellar.org`

## Examples

### Basic Escrow Creation

```typescript
import { EscrowService } from './dist/services/escrow.service.js';

const escrowService = new EscrowService();

const account = await escrowService.createAndValidateEscrowAccount('my-secure-key');

console.log('Account created:', account.publicKey);
console.log('Balance:', account.balance, 'XLM');
```

### Secret Decryption

```typescript
const secret = escrowService.decryptSecret(
  account.encryptedSecret, 
  'my-secure-key'
);

console.log('Decrypted secret:', secret);
```

### Account Validation

```typescript
const validation = await escrowService.validateAccountExistence(
  'GBQGEXZF36EQBJZ72QC5JEGUHBRI22CGUWEP7OVZA44OAJFFKKIRVDOE'
);

if (validation.exists) {
  console.log('Account balance:', validation.balance, 'XLM');
}
```

## Error Handling

The implementation includes comprehensive error handling:

- **No Encryption Key**: Provides clear instructions for setup
- **Funding Failures**: Detailed error messages from Horizon
- **Network Issues**: Graceful handling of connectivity problems
- **Invalid Keys**: Proper authentication error handling

## Horizon Integration

All accounts are fully compatible with Stellar Horizon API:

```bash
# Verify account via Horizon API
curl "https://horizon-testnet.stellar.org/accounts/YOUR_PUBLIC_KEY"
```

## Acceptance Criteria Met

✅ **Generate Stellar keypair** - Cryptographically secure random keypair generation  
✅ **Fund minimum XLM reserve** - Automatic funding via Friendbot (testnet) or master account (mainnet)  
✅ **Return publicKey** - Public key returned in all responses  
✅ **Return encrypted secret** - AES-256-GCM encrypted secret key  
✅ **Validate account existence** - Full validation via Horizon API  
✅ **New funded escrow account created on testnet** - Verified with test runs  
✅ **Account retrievable via Horizon** - Confirmed with API calls  

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass before submitting

## License

ISC License - See LICENSE file for details.
