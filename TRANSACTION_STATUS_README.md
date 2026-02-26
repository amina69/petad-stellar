# Transaction Status Checker

A robust transaction status checker for Stellar blockchain with reliable confirmation polling and graceful Horizon downtime handling.

## Features

✅ **Transaction Retrieval** - Get transaction details by hash with retry logic  
✅ **Ledger Verification** - Verify transaction inclusion in the ledger  
✅ **Confirmation Polling** - Poll for transaction confirmation with configurable options  
✅ **Horizon Downtime Handling** - Gracefully handle network issues with exponential backoff  
✅ **Submit & Wait** - Submit transaction and wait for confirmation in one call  

## Installation

```bash
npm install
npm run build
```

## Usage

### Programmatic API

```typescript
import { TransactionStatusChecker } from './services/transaction-status.service.js';
import { Config } from './config.js';

// Initialize
const config = Config.getInstance({
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
});

const statusChecker = new TransactionStatusChecker(config);

// Get transaction by hash
const status = await statusChecker.getTransactionByHash(txHash);
console.log('Confirmed:', status.confirmed);
console.log('Ledger:', status.ledger);
console.log('Timestamp:', status.timestamp);

// Poll for confirmation
const result = await statusChecker.pollForConfirmation(txHash, {
  maxAttempts: 30,
  intervalMs: 2000,
  timeoutMs: 60000,
});

// Verify ledger inclusion
const isIncluded = await statusChecker.verifyLedgerInclusion(txHash);

// Submit and wait for confirmation
const confirmResult = await statusChecker.submitAndWaitForConfirmation(
  transaction,
  { maxAttempts: 20, intervalMs: 1000 }
);
```

### CLI Usage

```bash
# Single check
npm run check-status -- --hash <transaction-hash>

# Poll for confirmation
npm run check-status -- --hash <transaction-hash> --poll

# Custom polling parameters
npm run check-status -- --hash <transaction-hash> --poll --max-attempts 50 --interval 1000

# Check mainnet transaction
npm run check-status -- --hash <transaction-hash> --mainnet
```

## API Reference

### `getTransactionByHash(txHash: string, retries?: number)`

Retrieves transaction details by hash with automatic retry logic for network errors.

**Parameters:**
- `txHash` - Transaction hash to retrieve
- `retries` - Number of retry attempts (default: 3)

**Returns:** `TransactionStatusResult`
```typescript
{
  confirmed: boolean;
  ledger?: number;
  timestamp?: string;
  hash: string;
  successful?: boolean;
  error?: string;
}
```

**Features:**
- Exponential backoff on network errors (1s, 2s, 4s)
- Returns `confirmed: false` for 404 errors (transaction not found)
- Throws error after all retries exhausted

---

### `pollForConfirmation(txHash: string, options?: PollingOptions)`

Polls for transaction confirmation with configurable retry logic.

**Parameters:**
- `txHash` - Transaction hash to poll
- `options` - Polling configuration
  - `maxAttempts` - Maximum polling attempts (default: 30)
  - `intervalMs` - Polling interval in milliseconds (default: 2000)
  - `timeoutMs` - Total timeout in milliseconds (default: 60000)

**Returns:** `TransactionStatusResult`

**Features:**
- Configurable polling interval and timeout
- Continues polling even during temporary Horizon downtime
- Returns detailed error if not confirmed after max attempts

---

### `verifyLedgerInclusion(txHash: string)`

Verifies that a transaction is included in a ledger.

**Parameters:**
- `txHash` - Transaction hash to verify

**Returns:** `boolean` - True if transaction is confirmed and included in a ledger

---

### `submitAndWaitForConfirmation(transaction: Transaction, options?: PollingOptions)`

Submits a transaction and waits for confirmation.

**Parameters:**
- `transaction` - Signed Stellar transaction
- `options` - Polling configuration (same as `pollForConfirmation`)

**Returns:** `TransactionStatusResult`

**Features:**
- Submits transaction to Horizon
- Automatically polls for confirmation
- Returns detailed status including ledger and timestamp

---

## Error Handling

The service gracefully handles various error scenarios:

### Network Errors
- **ECONNREFUSED** - Connection refused
- **ENOTFOUND** - DNS lookup failed
- **ETIMEDOUT** - Request timeout
- **ECONNRESET** - Connection reset

**Behavior:** Automatic retry with exponential backoff

### Horizon Downtime
- **Horizon unavailable** - Server temporarily down
- **Network errors** - Temporary connectivity issues

**Behavior:** Continues polling until timeout or max attempts reached

### Transaction Not Found (404)
**Behavior:** Returns `confirmed: false` with error message

### Timeout
**Behavior:** Throws error after configured timeout period

---

## Testing

Run the comprehensive test suite:

```bash
npm run build
npm run test-tx-status
```

**Test Coverage:**
- ✅ Retrieve confirmed transaction details
- ✅ Handle non-existent transactions
- ✅ Retry on network errors
- ✅ Poll until confirmation
- ✅ Timeout handling
- ✅ Custom polling options
- ✅ Ledger inclusion verification
- ✅ Submit and wait for confirmation
- ✅ Failed transaction handling
- ✅ Horizon downtime resilience

---

## Examples

### Example 1: Check Transaction Status

```typescript
import { TransactionStatusChecker } from './services/transaction-status.service.js';

const checker = new TransactionStatusChecker();
const status = await checker.getTransactionByHash(
  'abc123...'
);

if (status.confirmed) {
  console.log(`Transaction confirmed in ledger ${status.ledger}`);
  console.log(`Timestamp: ${status.timestamp}`);
} else {
  console.log(`Transaction not confirmed: ${status.error}`);
}
```

### Example 2: Poll for Confirmation

```typescript
const checker = new TransactionStatusChecker();

try {
  const result = await checker.pollForConfirmation('abc123...', {
    maxAttempts: 50,
    intervalMs: 1000,
    timeoutMs: 120000, // 2 minutes
  });

  console.log('Transaction confirmed!');
  console.log('Ledger:', result.ledger);
} catch (error) {
  console.error('Polling failed:', error.message);
}
```

### Example 3: Submit and Wait

```typescript
import { TransactionStatusChecker } from './services/transaction-status.service.js';
import { StellarService } from './stellar-service.js';

const stellarService = new StellarService();
const checker = new TransactionStatusChecker();

// Build transaction
const transaction = await stellarService.buildPaymentTransaction(
  sourceSecret,
  destinationPublicKey,
  '10.0'
);

// Submit and wait for confirmation
const result = await checker.submitAndWaitForConfirmation(transaction);

if (result.confirmed && result.successful) {
  console.log('Payment successful!');
  console.log('Transaction hash:', result.hash);
  console.log('Ledger:', result.ledger);
}
```

### Example 4: Verify Ledger Inclusion

```typescript
const checker = new TransactionStatusChecker();

const isIncluded = await checker.verifyLedgerInclusion('abc123...');

if (isIncluded) {
  console.log('Transaction is permanently recorded on the ledger');
} else {
  console.log('Transaction not found or not yet confirmed');
}
```

---

## Configuration

Configure via environment variables or Config instance:

```bash
# .env
HORIZON_URL=https://horizon-testnet.stellar.org
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Or programmatically:

```typescript
const config = Config.getInstance({
  horizonUrl: 'https://horizon.stellar.org',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
});

const checker = new TransactionStatusChecker(config);
```

---

## Best Practices

1. **Use Polling for New Transactions** - When submitting a new transaction, use `pollForConfirmation` or `submitAndWaitForConfirmation` to ensure it's confirmed.

2. **Set Appropriate Timeouts** - Stellar typically confirms transactions in 5-10 seconds, but set timeouts to account for network delays.

3. **Handle Horizon Downtime** - The service automatically retries on network errors, but implement fallback logic for extended outages.

4. **Verify Ledger Inclusion** - For critical transactions, use `verifyLedgerInclusion` to ensure permanent recording.

5. **Monitor Transaction Status** - Log transaction hashes and periodically check status for audit trails.

---

## Troubleshooting

### Transaction Not Found
- Wait a few seconds and retry
- Verify transaction was successfully submitted
- Check transaction hash is correct

### Polling Timeout
- Increase `maxAttempts` or `timeoutMs`
- Check Horizon server status
- Verify network connectivity

### Horizon Unavailable
- Service automatically retries with backoff
- Check Horizon status: https://status.stellar.org
- Consider using fallback Horizon servers

---

## License

ISC

## Contributing

Contributions welcome! Please submit issues and pull requests.
