# Stellar Funding Transaction Builder

This implementation provides deterministic funding transaction building for Stellar escrow accounts, with proper separation of concerns and comprehensive validation.

## Features

✅ **Payment Operation Building** - Creates Stellar payment operations  
✅ **Memo Support** - Attaches escrowId as text memo  
✅ **Owner Secret Signing** - Signs transactions with source account secret  
✅ **Transaction Hash Generation** - Returns unique transaction identifier  
✅ **XDR Encoding** - Returns transaction in Stellar XDR format  
✅ **Separate Build/Submit** - `buildFundingTx()` and `submitTx()` methods  
✅ **Parameter Validation** - Comprehensive input validation  
✅ **Testnet Support** - Full testnet compatibility  

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Build Funding Transaction

```bash
# Using environment variables
SOURCE_SECRET="your-secret" \
DESTINATION_PUBLIC_KEY="destination-pubkey" \
npm run build-funding

# Using CLI options
npm run build-funding --secret "S..." --destination "G..." --amount "5.0" --escrow-id "my-escrow-001"
```

### Programmatic Usage

```typescript
import { FundingService, Config } from './dist/index.js';

// Initialize service
const config = Config.getInstance({
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
});

const fundingService = new FundingService(config);

// Build funding transaction (no submission)
const result = await fundingService.buildEscrowFundingTx(
  'SD...', // source secret
  'GB...', // destination public key
  'escrow-001', // escrow ID
  '2.0' // amount in XLM
);

console.log('Transaction Hash:', result.txHash);
console.log('XDR:', result.xdr);

// Submit later
const submissionResult = await fundingService.submitTx(result.transaction);
console.log('Submitted:', submissionResult.successful);
```

## API Reference

### FundingService

#### `buildFundingTx(params: FundingTxParams): Promise<FundingTxResult>`

Builds a deterministic funding transaction with payment operation and memo.

**Parameters:**
```typescript
interface FundingTxParams {
  sourceSecret: string;           // Source account secret key
  destinationPublicKey: string;    // Destination public key
  amount: string;                // Amount in XLM
  escrowId: string;              // Escrow identifier for memo
  asset?: StellarSdk.Asset;        // Asset (defaults to XLM native)
}
```

**Returns:**
```typescript
interface FundingTxResult {
  txHash: string;                 // Transaction hash
  xdr: string;                   // XDR encoded transaction
  transaction: StellarSdk.Transaction; // Transaction object
}
```

#### `buildEscrowFundingTx(sourceSecret, escrowPublicKey, escrowId, amount): Promise<FundingTxResult>`

Convenience method for building escrow funding transactions.

#### `submitTx(transaction: StellarSdk.Transaction): Promise<TxSubmissionResult>`

Submits a signed transaction to the Stellar network.

**Returns:**
```typescript
interface TxSubmissionResult {
  hash: string;        // Transaction hash
  status: string;      // 'success' or 'failed'
  successful: boolean; // Success status
}
```

#### `submitTxFromXDR(xdr: string): Promise<TxSubmissionResult>`

Submits a transaction from XDR string.

#### `validateSignedTx(xdr: string): ValidationResult`

Validates a signed transaction without submitting.

**Returns:**
```typescript
interface ValidationResult {
  valid: boolean;
  transaction?: StellarSdk.Transaction;
  error?: string;
}
```

#### `getTxStatus(txHash: string): Promise<TxSubmissionResult>`

Gets transaction status from Horizon.

## CLI Usage

### Basic Commands

```bash
# Show help
npm run build-funding --help

# Build transaction (no submission)
npm run build-funding

# Build and submit transaction
npm run build-funding --submit

# Use custom parameters
npm run build-funding \
  --secret "SD..." \
  --destination "GB..." \
  --amount "5.0" \
  --escrow-id "my-escrow-001" \
  --submit
```

### Environment Variables

- `SOURCE_SECRET` - Source account secret key
- `DESTINATION_PUBLIC_KEY` - Destination public key
- `FUNDING_AMOUNT` - Funding amount (default: 2.0 XLM)
- `ESCROW_ID` - Escrow identifier (default: auto-generated)

### CLI Options

```
--secret, -s <secret>        Source account secret key
--destination, -d <public>     Destination public key
--amount, -a <amount>         Funding amount (default: 2.0 XLM)
--escrow-id, -e <id>        Escrow identifier
--mainnet                     Use mainnet instead of testnet
--submit                      Submit transaction after building
--help, -h                    Show help message
```

## Separation of Concerns

The implementation properly separates building and submission:

### ✅ `buildFundingTx()`
- Creates payment operation
- Attaches memo with escrowId
- Signs with owner secret
- Returns txHash and XDR
- **Does NOT auto-submit**

### ✅ `submitTx()`
- Takes pre-built transaction
- Submits to network
- Returns submission result
- Separate from building logic

### ✅ `validateSignedTx()`
- Validates transaction structure
- Checks signatures
- No network submission
- Pure validation logic

## Transaction Structure

When built successfully, transactions include:

```typescript
{
  source: "G...",           // Source account
  fee: 100,               // Fee in stroops
  sequence: "123456789",    // Account sequence
  operations: [
    {
      type: "payment",
      destination: "G...",   // Escrow account
      amount: "2.0000000",  // Funding amount
      asset: { type: "native" }
    }
  ],
  memo: {
    type: "text",
    value: "escrow-001"     // Escrow ID
  },
  signatures: [...]          // Owner account signature
}
```

## Validation Features

The service includes comprehensive validation:

### ✅ Input Validation
- **Source Secret**: Validates Stellar secret format
- **Destination**: Validates public key format
- **Amount**: Must be positive number
- **Escrow ID**: Required, max 28 characters

### ✅ Transaction Validation
- **Signatures**: Must be signed
- **Operations**: Must contain operations
- **Structure**: Valid Stellar transaction

## Testing

### Run Tests

```bash
# Run funding transaction tests
npm run test-funding

# Run demonstration
npm run demo-funding

# Run escrow tests
npm run test-escrow
```

### Test Coverage

The test suite includes:
- ✅ Payment operation building
- ✅ Memo attachment with escrowId
- ✅ Owner secret signing
- ✅ Transaction hash generation
- ✅ XDR encoding/decoding
- ✅ Parameter validation
- ✅ Error handling
- ✅ Separation of concerns

## Examples

### Basic Funding Transaction

```typescript
const fundingService = new FundingService();

const result = await fundingService.buildEscrowFundingTx(
  'SDABCDEFGHIJKLMNOPQRSTUVWXYZ123456789', // source secret
  'GBQGEXZF36EQBJZ72QC5JEGUHBRI22CGUWEP7OVZA44OAJFFKKIRVDOE', // escrow
  'escrow-001', // escrow ID
  '2.0' // amount
);

console.log('Hash:', result.txHash);
console.log('XDR:', result.xdr);
```

### Submit Transaction Later

```typescript
// Submit the built transaction
const submissionResult = await fundingService.submitTx(result.transaction);

if (submissionResult.successful) {
  console.log('Transaction submitted:', submissionResult.hash);
} else {
  console.log('Submission failed:', submissionResult.status);
}
```

### Submit from XDR

```typescript
// Submit from stored XDR
const xdr = 'AAAAAgAAAAB...'; // Previously stored XDR
const result = await fundingService.submitTxFromXDR(xdr);
```

### Validate Transaction

```typescript
// Validate without submitting
const validation = fundingService.validateSignedTx(xdr);

if (validation.valid) {
  console.log('Transaction is valid');
  console.log('Operations:', validation.transaction?.operations.length);
} else {
  console.log('Validation failed:', validation.error);
}
```

## Network Support

### Testnet
- **Horizon URL**: `https://horizon-testnet.stellar.org`
- **Network Passphrase**: `Test SDF Network ; September 2015`
- **Default**: Enabled in CLI

### Mainnet
- **Horizon URL**: `https://horizon.stellar.org`
- **Network Passphrase**: `Public Global Stellar Network ; September 2015`
- **CLI Option**: `--mainnet`

## Security Features

### ✅ Secret Key Handling
- Secrets only used for signing
- No plaintext storage
- Environment variable support

### ✅ Transaction Validation
- Comprehensive input validation
- Signature verification
- Structure validation

### ✅ Error Handling
- Detailed error messages
- Graceful failure handling
- Clear user guidance

## Acceptance Criteria Met

✅ **Build payment operation** - Creates Stellar payment operations  
✅ **Attach memo (escrowId)** - Adds text memo with escrow identifier  
✅ **Sign with owner secret (dev only)** - Signs with source account secret  
✅ **Return txHash** - Returns unique transaction hash  
✅ **Return XDR** - Returns XDR encoded transaction  
✅ **Do NOT auto-submit in builder method** - `buildFundingTx()` only builds  
✅ **Separation: buildFundingTx() and submitTx()** - Separate methods for building and submission  
✅ **Valid signed funding tx** - Creates properly signed transactions  
✅ **Works on testnet** - Full testnet compatibility verified  

## Contributing

1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass before submitting

## License

ISC License - See LICENSE file for details.
