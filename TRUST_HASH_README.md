# Trust Hash Anchoring

## Overview

The Trust Hash Anchoring feature allows you to permanently record trust snapshot hashes on the Stellar blockchain. This provides an immutable, timestamped record that can be used for verification and audit purposes.

## How It Works

The system creates a minimal self-payment transaction (0.00001 XLM) with the trust hash stored in the transaction memo field. This ensures:

- **Immutability**: Once recorded, the hash cannot be altered
- **Timestamp**: Blockchain timestamp proves when the hash was anchored
- **Verifiability**: Anyone can verify the hash on the public Stellar network
- **Cost-effective**: Minimal transaction cost (0.00001 XLM + network fee)

## Requirements

- Trust hash must be **28 bytes or less** (Stellar memo text limit)
- Valid Stellar account with sufficient balance (minimum 0.00002 XLM)
- Secret key for signing the transaction

## Usage

### Programmatic API

```typescript
import PetAdChain from '@petad/stellar-sdk';

const chain = new PetAdChain({ useTestnet: true });

// Anchor a trust hash
const result = await chain.anchorTrustHash(
  'trust-snapshot-123',  // Hash (max 28 bytes)
  'SXXX...'              // Secret key
);

console.log('Transaction Hash:', result.hash);
console.log('Verified:', result.verified);
console.log('Timestamp:', result.timestamp);
```

### CLI Tool

```bash
# Basic usage
npm run anchor-trust-hash -- --hash "trust-snapshot-123"

# With custom secret key
npm run anchor-trust-hash -- --hash "abc123" --secret SXXX...

# On mainnet
npm run anchor-trust-hash -- --hash "prod-hash" --mainnet

# Show help
npm run anchor-trust-hash -- --help
```

## Response Format

```typescript
interface TrustHashResult {
  hash: string;        // Transaction hash on Stellar
  verified: boolean;   // Whether transaction was successful
  timestamp?: Date;    // When the hash was anchored
}
```

## Verification

### On-Chain Verification

View the transaction on Stellar Explorer:

**Testnet:**
```
https://horizon-testnet.stellar.org/transactions/{transaction_hash}
```

**Mainnet:**
```
https://horizon.stellar.org/transactions/{transaction_hash}
```

The trust hash will be visible in the `memo` field.

### Programmatic Verification

```typescript
// Get transaction details
const txStatus = await chain.getTransactionStatus(result.hash);

// Verify it was successful
if (txStatus.successful) {
  console.log('Hash successfully anchored on-chain');
}
```

### API Verification

```bash
# Testnet
curl "https://horizon-testnet.stellar.org/transactions/{tx_hash}" | jq '.memo'

# Mainnet
curl "https://horizon.stellar.org/transactions/{tx_hash}" | jq '.memo'
```

## Examples

### Example 1: Anchor Trust Snapshot

```typescript
import PetAdChain from '@petad/stellar-sdk';
import crypto from 'crypto';

// Create hash of trust data
const trustData = {
  userId: 'user-123',
  score: 95,
  timestamp: Date.now()
};

const hash = crypto
  .createHash('sha256')
  .update(JSON.stringify(trustData))
  .digest('hex')
  .substring(0, 28); // Truncate to 28 bytes

// Anchor on blockchain
const chain = new PetAdChain({ useTestnet: false });
const result = await chain.anchorTrustHash(hash, process.env.SECRET_KEY!);

console.log(`Trust snapshot anchored: ${result.hash}`);
```

### Example 2: Batch Anchoring

```typescript
const hashes = [
  'trust-user-001',
  'trust-user-002',
  'trust-user-003'
];

for (const hash of hashes) {
  const result = await chain.anchorTrustHash(hash, secretKey);
  console.log(`${hash} -> ${result.hash}`);
  
  // Wait 5 seconds between transactions to avoid rate limits
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

### Example 3: Verify Historical Hash

```typescript
// Verify a hash was anchored at a specific time
const txHash = 'e4669f30afa2ca0993f764817976a87a2a34602356e72833e61bfd3b2a15e621';
const txStatus = await chain.getTransactionStatus(txHash);

if (txStatus.successful) {
  console.log('Hash was successfully anchored');
  // Fetch full transaction details to see memo
}
```

## Error Handling

```typescript
try {
  const result = await chain.anchorTrustHash(hash, secretKey);
} catch (error) {
  if (error.message.includes('exceeds 28 bytes')) {
    console.error('Hash is too long - must be 28 bytes or less');
  } else if (error.message.includes('insufficient balance')) {
    console.error('Account needs more XLM');
  } else {
    console.error('Failed to anchor hash:', error);
  }
}
```

## Best Practices

1. **Hash Length**: Keep hashes under 28 bytes. Use truncated SHA-256 hashes or short identifiers.

2. **Cost Management**: Each anchoring costs ~0.00001 XLM + network fee (~0.00001 XLM). Budget accordingly for batch operations.

3. **Rate Limiting**: Stellar has rate limits. Wait 5 seconds between transactions for batch operations.

4. **Network Selection**: Use testnet for development, mainnet for production.

5. **Key Security**: Never expose secret keys. Use environment variables or secure key management.

6. **Verification**: Always verify the transaction was successful before considering the hash anchored.

## Limitations

- Maximum hash size: **28 bytes** (Stellar memo text limit)
- Minimum account balance: **0.00002 XLM** (for transaction + fee)
- Network fees apply: ~0.00001 XLM per transaction
- Rate limits: ~100 transactions per minute per account

## Testing

Run the test suite:

```bash
# Run trust hash anchoring tests
npm run test-trust-hash

# Build and test
npm run build && npm run test-trust-hash
```

## Security Considerations

- **Private Keys**: Never commit secret keys to version control
- **Network Validation**: Always verify you're on the correct network (testnet vs mainnet)
- **Hash Uniqueness**: Ensure hashes are unique to avoid confusion
- **Audit Trail**: Maintain off-chain records linking hashes to their source data

## Acceptance Criteria ✅

- [x] Create minimal payment (0.00001 XLM self-payment)
- [x] Memo.text(hash) - Hash stored in transaction memo
- [x] Return transaction hash
- [x] Validate memo size (28 bytes max for text)
- [x] Trust hash visible on-chain

## Related Documentation

- [Stellar Memos](https://developers.stellar.org/docs/encyclopedia/memos)
- [Transaction Lifecycle](https://developers.stellar.org/docs/fundamentals-and-concepts/stellar-data-structures/operations-and-transactions)
- [Horizon API Reference](https://developers.stellar.org/api/horizon)
