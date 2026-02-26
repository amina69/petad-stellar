# Network Guard Documentation

## Overview

The Network Guard system prevents accidental transaction submissions to the Stellar public network (mainnet) during development. It provides multiple layers of protection through environment-based validation and explicit consent requirements.

## Features

### 1. Explicit Testnet/Public Toggle
- Environment variables control which network is active
- Clear separation between testnet and public network configurations

### 2. Development Mode Protection
- Automatically blocks public network transactions when `NODE_ENV !== 'production'`
- Prevents accidental mainnet submissions during development

### 3. Explicit Consent Requirement
- Public network transactions require `ALLOW_PUBLIC_NETWORK=true`
- Double confirmation prevents unintended mainnet operations

### 4. Network Validation
- Validates network configuration before every transaction submission
- Throws `NetworkGuardError` if wrong network is selected

## Configuration

### Environment Variables

```bash
# Network Configuration
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Network Guard Settings
NODE_ENV=development                # Set to 'production' for mainnet
ALLOW_PUBLIC_NETWORK=false          # Set to 'true' to allow mainnet transactions
```

### Testnet Configuration (Default)

```bash
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NODE_ENV=development
ALLOW_PUBLIC_NETWORK=false
```

### Public Network Configuration (Mainnet)

```bash
HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
NODE_ENV=production
ALLOW_PUBLIC_NETWORK=true
```

## Usage

### Automatic Protection

All services automatically use network guards:

```typescript
import { StellarService } from './stellar-service.js';
import { EscrowService } from './services/escrow.service.js';
import { FundingService } from './services/funding.service.js';

// Services automatically validate network before transaction submission
const stellarService = new StellarService();
const escrowService = new EscrowService();
const fundingService = new FundingService();

// This will throw NetworkGuardError if:
// - NODE_ENV=development and network is public
// - ALLOW_PUBLIC_NETWORK=false and network is public
await stellarService.submitTransaction(transaction);
```

### Custom Network Guard

```typescript
import { NetworkGuard, NetworkType } from './guards/network.guard.js';
import { Config } from './config.js';

// Testnet-only guard (strictest)
const testnetGuard = NetworkGuard.testnetOnly();

// Guard with public consent (default)
const consentGuard = NetworkGuard.withPublicConsent();

// Custom guard configuration
const customGuard = new NetworkGuard(config, {
  allowedNetwork: NetworkType.TESTNET,
  requireExplicitConsent: true,
  isDevelopment: true
});

// Validate before operations
customGuard.validateTransactionSubmission();
```

### Network Information

```typescript
const guard = new NetworkGuard();

// Get current network type
const network = guard.getCurrentNetwork(); // 'testnet' | 'public'

// Check network type
const isTestnet = guard.isTestnet();
const isPublic = guard.isPublic();

// Get detailed network info
const info = guard.getNetworkInfo();
console.log(info);
// {
//   network: 'testnet',
//   horizonUrl: 'https://horizon-testnet.stellar.org',
//   networkPassphrase: 'Test SDF Network ; September 2015',
//   isDevelopment: true
// }
```

## Error Handling

### NetworkGuardError

All network guard violations throw `NetworkGuardError`:

```typescript
import { NetworkGuardError } from './guards/network.guard.js';

try {
  await stellarService.submitTransaction(transaction);
} catch (error) {
  if (error instanceof NetworkGuardError) {
    console.error('Network guard blocked transaction:', error.message);
    // Handle network configuration error
  } else {
    // Handle other errors
  }
}
```

### Common Error Messages

1. **Development Mode Block**
   ```
   NETWORK GUARD: Cannot submit transactions to PUBLIC network in development mode.
   Set NODE_ENV=production and ALLOW_PUBLIC_NETWORK=true to enable public network access.
   ```

2. **Missing Explicit Consent**
   ```
   NETWORK GUARD: Public network transaction blocked.
   Set ALLOW_PUBLIC_NETWORK=true environment variable to explicitly allow public network transactions.
   ```

3. **Wrong Network Selected**
   ```
   NETWORK GUARD: Current network is PUBLIC but only TESTNET is allowed.
   Check your HORIZON_URL and NETWORK_PASSPHRASE configuration.
   ```

## Testing

Run the network guard tests:

```bash
npm run build
node dist/src/network-guard.test.js
```

### Test Coverage

- ✅ Testnet-only guard allows testnet transactions
- ✅ Testnet-only guard blocks public network transactions
- ✅ Development mode blocks public network
- ✅ Public network requires explicit consent
- ✅ Public network allowed with proper configuration
- ✅ Network info retrieval
- ✅ Wrong network detection

## Integration Points

Network guards are integrated at all transaction submission points:

1. **StellarService.submitTransaction()**
   - Validates before submitting any transaction

2. **FundingService.submitTx()**
   - Validates before submitting funding transactions

3. **EscrowService** (indirect)
   - Uses StellarService which validates automatically

## Best Practices

### Development

1. Always use testnet configuration
2. Keep `NODE_ENV=development`
3. Keep `ALLOW_PUBLIC_NETWORK=false`

```bash
# .env for development
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NODE_ENV=development
ALLOW_PUBLIC_NETWORK=false
```

### Production

1. Explicitly set `NODE_ENV=production`
2. Explicitly set `ALLOW_PUBLIC_NETWORK=true`
3. Use public network configuration
4. Review all environment variables before deployment

```bash
# .env for production
HORIZON_URL=https://horizon.stellar.org
NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
NODE_ENV=production
ALLOW_PUBLIC_NETWORK=true
```

### CI/CD

Add environment validation to your deployment pipeline:

```bash
#!/bin/bash
# validate-network.sh

if [ "$NODE_ENV" = "production" ] && [ "$ALLOW_PUBLIC_NETWORK" = "true" ]; then
  echo "✅ Production network configuration valid"
else
  echo "❌ Invalid production configuration"
  exit 1
fi
```

## Migration Guide

### Existing Code

No changes required! Network guards are automatically applied to all services:

```typescript
// Before (still works)
const service = new StellarService();
await service.submitTransaction(tx);

// After (same code, now protected)
const service = new StellarService();
await service.submitTransaction(tx); // Validates network automatically
```

### Custom Guards

If you need custom network validation:

```typescript
import { NetworkGuard } from './guards/network.guard.js';

// Pass custom guard to services
const customGuard = NetworkGuard.testnetOnly();
const service = new StellarService(config, customGuard);
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files with production credentials
2. **Double Check**: Always verify `NODE_ENV` and `ALLOW_PUBLIC_NETWORK` before mainnet operations
3. **Audit Logs**: Log all network guard validations in production
4. **Access Control**: Restrict who can set `ALLOW_PUBLIC_NETWORK=true`

## Troubleshooting

### "Cannot submit transactions to PUBLIC network in development mode"

**Solution**: Either switch to testnet or set `NODE_ENV=production` and `ALLOW_PUBLIC_NETWORK=true`

### "Public network transaction blocked"

**Solution**: Set `ALLOW_PUBLIC_NETWORK=true` in your environment

### "Current network is PUBLIC but only TESTNET is allowed"

**Solution**: Check your `HORIZON_URL` and `NETWORK_PASSPHRASE` configuration

## API Reference

### NetworkGuard Class

```typescript
class NetworkGuard {
  constructor(config?: Config, guardConfig?: NetworkGuardConfig)
  
  // Validation methods
  validateNetwork(): void
  validateTransactionSubmission(): void
  
  // Network checks
  getCurrentNetwork(): NetworkType
  isTestnet(): boolean
  isPublic(): boolean
  
  // Information
  getNetworkInfo(): NetworkInfo
  
  // Factory methods
  static testnetOnly(config?: Config): NetworkGuard
  static withPublicConsent(config?: Config): NetworkGuard
}
```

### NetworkGuardError

```typescript
class NetworkGuardError extends Error {
  constructor(message: string)
}
```

### NetworkType Enum

```typescript
enum NetworkType {
  TESTNET = 'testnet',
  PUBLIC = 'public'
}
```

## Support

For issues or questions about network guards:
1. Check this documentation
2. Review error messages carefully
3. Verify environment configuration
4. Run network guard tests
