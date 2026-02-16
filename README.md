# PetAd Chain — Stellar SDK ⛓️

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-SDK-7D00FF.svg)](https://stellar.org/)
[![npm](https://img.shields.io/badge/npm-@petad/stellar--sdk-red.svg)](https://www.npmjs.com/package/@stellar/stellar-sdk)


Production-grade blockchain infrastructure SDK for PetAd. Provides secure, reusable utilities and abstractions for escrow, custody guarantees, and transaction management on the Stellar network.

> **⚠️ SECURITY CRITICAL:** This SDK handles blockchain transactions and private keys. It requires rigorous testing and external security audits before production use.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Purpose](#purpose)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [As a Dependency](#as-a-dependency)
  - [From Source](#from-source)
- [Configuration](#configuration)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
  - [Escrow Account Creation](#escrow-account-creation)
  - [Multisig Transaction](#multisig-transaction)
  - [Custody Lock & Release](#custody-lock--release)
  - [Event Verification](#event-verification)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Security Guidelines](#security-guidelines)
- [Scripts](#scripts)
- [Deployment Tools](#deployment-tools)
- [Contributing](#contributing)
- [Audit & Security](#audit--security)
- [License](#license)

---

## 🌟 Overview

**PetAd Chain** is the blockchain infrastructure layer powering the PetAd platform. It serves as a standalone TypeScript SDK that abstracts the complexity of Stellar blockchain operations into clean, type-safe APIs.

This repository is designed to be:

- 📦 **Modular** - Use as a library in your backend or as a standalone service
- 🔒 **Security-First** - Built with security best practices and external audit readiness
- 🧪 **Well-Tested** - Comprehensive test suite covering all escrow scenarios
- 🎯 **Production-Ready** - Battle-tested abstractions for real-world blockchain operations

### System Context

```
┌─────────────────────────────────────────────────────┐
│           PetAd Backend (NestJS)                    │
│         Application Logic Layer                     │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ imports @petad/stellar-sdk
                    ▼
┌─────────────────────────────────────────────────────┐
│        PetAd Chain SDK (This Repository)            │
│    ┌──────────────────────────────────────────┐    │
│    │  Escrow Utilities                        │    │
│    └──────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────┐    │
│    │  Transaction Builders                    │    │
│    └──────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────┐    │
│    │  Account Management                      │    │
│    └──────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────┐    │
│    │  Horizon Client Wrapper                  │    │
│    └──────────────────────────────────────────┘    │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ Stellar SDK
                    ▼
┌─────────────────────────────────────────────────────┐
│         Stellar Network (Testnet/Mainnet)           │
│              Blockchain Layer                       │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Purpose

This SDK abstracts blockchain complexity and exposes **clean, type-safe APIs** for:

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Escrow Account Creation** | Generate 2-of-3 multisig escrow accounts with time locks |
| **Multisig Orchestration** | Build and sign multi-signature transactions |
| **Custody Locking** | Lock funds in escrow for time-bound custody agreements |
| **Automatic Release** | Time-based or condition-based escrow settlement |
| **Event Verification** | Cryptographically verify on-chain event anchoring |
| **Network Abstraction** | Seamless switching between testnet and mainnet |

---

## ✨ Features

- ✅ **Type-Safe** - Full TypeScript support with strict typing
- ✅ **Idempotent** - Safe to retry all operations
- ✅ **Testnet Support** - Complete testing infrastructure
- ✅ **Error Handling** - Comprehensive error types and recovery
- ✅ **Transaction Monitoring** - Track transaction status and confirmations
- ✅ **Key Management** - Secure key handling with HSM support
- ✅ **Gas Optimization** - Minimal transaction fees
- ✅ **Event Anchoring** - Hash-based event verification on-chain

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | 5.0+ | Type-safe development |
| **Stellar SDK** | Latest | Blockchain interaction |
| **Node.js** | 20+ | Runtime environment |
| **Jest** | Latest | Testing framework |
| **ESLint** | Latest | Code quality |
| **Prettier** | Latest | Code formatting |

---

## 📦 Prerequisites

- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0` or **pnpm** `>= 8.0.0`
- **Stellar Account** (testnet or mainnet)
- **TypeScript** knowledge recommended

**Verify installations:**

```bash
node --version
npm --version
```

---

## 🚀 Installation

### As a Dependency

Install in your project:

```bash
npm install @petad/stellar-sdk
```

Or with pnpm:

```bash
pnpm add @petad/stellar-sdk
```

Or with yarn:

```bash
yarn add @petad/stellar-sdk
```

---

### From Source

Clone and build locally:

```bash
# 1. Clone the repository
git clone https://github.com/petad/petad-chain.git
cd petad-chain

# 2. Install dependencies
npm install

# 3. Build the SDK
npm run build

# 4. Link locally (for development)
npm link
```

**In your project:**

```bash
npm link @petad/stellar-sdk
```

---

## ⚙️ Configuration

### Environment Setup

Create a `.env` file in your project root:

```env
# Network Configuration
STELLAR_NETWORK=testnet              # Options: testnet | public
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Platform Keys (for escrow operations)
MASTER_SECRET_KEY=S...               # Platform escrow signing key
MASTER_PUBLIC_KEY=G...               # Platform public address

# Optional: Advanced Configuration
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
TRANSACTION_TIMEOUT=180              # seconds
MAX_FEE=10000                        # stroops (0.001 XLM)
```


### Testnet Setup

1. **Generate keypair:**
   ```bash
   npm run generate-keypair
   ```

2. **Fund account:**
   - Visit: https://friendbot.stellar.org
   - Paste your public key (G...)
   - Get 10,000 test XLM

3. **Verify account:**
   ```bash
   npm run verify-account -- YOUR_PUBLIC_KEY
   ```

---

## 🎬 Quick Start

### Basic Usage

```typescript
import { StellarSDK } from '@petad/stellar-sdk';

// Initialize SDK
const sdk = new StellarSDK({
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  masterSecretKey: process.env.MASTER_SECRET_KEY
});

// Create an escrow account
const escrow = await sdk.escrow.createAccount({
  adopterPublicKey: 'G...',
  ownerPublicKey: 'G...',
  depositAmount: '100', // XLM
  duration: 30 // days
});

console.log('Escrow created:', escrow.accountId);
console.log('Transaction hash:', escrow.transactionHash);
```

---

## 📚 Usage Examples

### Escrow Account Creation

Create a 2-of-3 multisig escrow account for adoption deposits:

```typescript
import { createEscrowAccount } from '@petad/stellar-sdk';

async function setupAdoptionEscrow() {
  const escrow = await createEscrowAccount({
    // Signer 1: Adopter
    adopterPublicKey: 'GADOPTER...',
    
    // Signer 2: Pet Owner/Shelter
    ownerPublicKey: 'GOWNER...',
    
    // Signer 3: Platform (automatically added)
    // platformPublicKey is read from env
    
    // Escrow configuration
    depositAmount: '500',  // 500 XLM deposit
    adoptionFee: '50',     // 50 XLM platform fee
    
    // Time lock (optional)
    unlockDate: new Date('2026-03-15'),
    
    // Metadata
    petId: 'pet-12345',
    adoptionId: 'adoption-67890'
  });

  return {
    escrowAccountId: escrow.accountId,
    transactionHash: escrow.hash,
    signers: escrow.signers,
    thresholds: escrow.thresholds
  };
}
```

**Response:**

```typescript
{
  escrowAccountId: 'GESCROW...',
  transactionHash: '0x123abc...',
  signers: [
    { publicKey: 'GADOPTER...', weight: 1 },
    { publicKey: 'GOWNER...', weight: 1 },
    { publicKey: 'GPLATFORM...', weight: 1 }
  ],
  thresholds: {
    low: 0,
    medium: 2,  // 2-of-3 required
    high: 2
  }
}
```

---

### Multisig Transaction

Build and sign a multisig transaction to release escrow funds:

```typescript
import { buildMultisigTransaction, signTransaction } from '@petad/stellar-sdk';

async function releaseEscrowFunds() {
  // 1. Build transaction
  const transaction = await buildMultisigTransaction({
    sourceAccount: 'GESCROW...', // Escrow account
    operations: [
      {
        type: 'payment',
        destination: 'GOWNER...',
        amount: '450',  // Release to owner
        asset: 'native' // XLM
      },
      {
        type: 'payment',
        destination: 'GPLATFORM...',
        amount: '50',   // Platform fee
        asset: 'native'
      }
    ],
    memo: 'Adoption #67890 - Completed',
    fee: '1000' // 0.0001 XLM
  });

  // 2. Sign with adopter key
  const adopterSigned = await signTransaction(
    transaction,
    'SADOPTERSECRET...'
  );

  // 3. Sign with platform key
  const platformSigned = await signTransaction(
    adopterSigned,
    process.env.MASTER_SECRET_KEY
  );

  // 4. Submit to network (2-of-3 threshold met)
  const result = await sdk.horizon.submitTransaction(platformSigned);

  return {
    successful: result.successful,
    hash: result.hash,
    ledger: result.ledger
  };
}
```

---

### Custody Lock & Release

Lock funds for temporary custody with automatic time-based release:

```typescript
import { lockCustodyFunds, scheduleCustodyRelease } from '@petad/stellar-sdk';

async function setupTemporaryCustody() {
  // 1. Lock custody deposit
  const lock = await lockCustodyFunds({
    custodianPublicKey: 'GCUSTODIAN...',
    ownerPublicKey: 'GOWNER...',
    depositAmount: '200',
    durationDays: 14,
    
    // Conditions for early release
    conditions: {
      noViolations: true,
      petReturned: true
    }
  });

  // 2. Schedule automatic release
  const releaseSchedule = await scheduleCustodyRelease({
    escrowAccountId: lock.accountId,
    releaseDate: lock.unlockDate,
    
    // Release distribution
    distribution: [
      { recipient: 'GOWNER...', percentage: 95 },
      { recipient: 'GPLATFORM...', percentage: 5 }
    ]
  });

  return {
    custodyId: lock.accountId,
    lockedAmount: lock.amount,
    unlockDate: lock.unlockDate,
    scheduledReleaseId: releaseSchedule.id
  };
}
```

---

### Event Verification

Verify that an event was properly anchored on the Stellar blockchain:

```typescript
import { verifyEventHash, anchorEventHash } from '@petad/stellar-sdk';

// Anchor an event
async function anchorAdoptionEvent(adoptionData: any) {
  const eventHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(adoptionData))
    .digest('hex');

  const anchoring = await anchorEventHash({
    hash: eventHash,
    eventType: 'ADOPTION_COMPLETED',
    metadata: {
      adoptionId: adoptionData.id,
      timestamp: new Date().toISOString()
    }
  });

  return {
    eventHash,
    transactionHash: anchoring.txHash,
    ledger: anchoring.ledger
  };
}

// Verify the event later
async function verifyAdoption(eventHash: string, txHash: string) {
  const verification = await verifyEventHash({
    expectedHash: eventHash,
    transactionHash: txHash
  });

  return {
    verified: verification.isValid,
    timestamp: verification.timestamp,
    ledger: verification.ledger,
    confirmations: verification.confirmations
  };
}
```

---

## 📁 Project Structure

```
src/
├── escrow/                   # Escrow lifecycle management
│   ├── create.ts            # Account creation
│   ├── lock.ts              # Fund locking
│   ├── release.ts           # Settlement logic
│   ├── dispute.ts           # Dispute handling
│   └── types.ts             # Type definitions
│
├── accounts/                 # Account utilities
│   ├── create.ts            # Account generation
│   ├── fund.ts              # Funding operations
│   ├── multisig.ts          # Multisig configuration
│   └── keypair.ts           # Key management
│
├── transactions/             # Transaction builders
│   ├── builder.ts           # Transaction construction
│   ├── signer.ts            # Signing utilities
│   ├── submit.ts            # Network submission
│   └── monitor.ts           # Status tracking
│
├── clients/                  # Network clients
│   ├── horizon.ts           # Horizon API wrapper
│   ├── friendbot.ts         # Testnet funding
│   └── network.ts           # Network utilities
│
├── utils/                    # Shared utilities
│   ├── crypto.ts            # Hashing, signing
│   ├── errors.ts            # Error types
│   ├── validation.ts        # Input validation
│   └── constants.ts         # Network constants
│
├── index.ts                  # Main SDK export
└── types/                    # Global type definitions
    ├── escrow.ts
    ├── transaction.ts
    └── network.ts
```

---

## 📖 API Reference

### Core Classes

#### `StellarSDK`

Main SDK entry point.

```typescript
class StellarSDK {
  constructor(config: SDKConfig);
  
  escrow: EscrowManager;
  accounts: AccountManager;
  transactions: TransactionManager;
  horizon: HorizonClient;
}
```

#### `EscrowManager`

Handles escrow operations.

```typescript
class EscrowManager {
  createAccount(params: CreateEscrowParams): Promise<EscrowAccount>;
  lockFunds(params: LockFundsParams): Promise<LockResult>;
  releaseFunds(params: ReleaseParams): Promise<ReleaseResult>;
  handleDispute(params: DisputeParams): Promise<DisputeResult>;
}
```

#### `TransactionManager`

Builds and manages transactions.

```typescript
class TransactionManager {
  build(params: BuildParams): Promise<Transaction>;
  sign(tx: Transaction, secretKey: string): Promise<Transaction>;
  submit(tx: Transaction): Promise<SubmitResult>;
  monitor(hash: string): Promise<TransactionStatus>;
}
```

### Type Definitions

```typescript
interface CreateEscrowParams {
  adopterPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  adoptionFee?: string;
  unlockDate?: Date;
  metadata?: Record<string, any>;
}

interface EscrowAccount {
  accountId: string;
  transactionHash: string;
  signers: Signer[];
  thresholds: Thresholds;
  unlockDate?: Date;
}

interface Signer {
  publicKey: string;
  weight: number;
}

interface Thresholds {
  low: number;
  medium: number;
  high: number;
}
```

---

## 🔒 Security Guidelines

### Critical Security Requirements

✅ **Transaction Review**
- Always verify transaction details before signing
- Implement multi-party approval for high-value transactions
- Log all transactions for audit trails

✅ **Network Validation**
- Verify network before submitting transactions
- Use testnet for all development and testing
- Double-check Horizon URLs

✅ **Input Validation**
- Validate all user inputs
- Sanitize public keys and amounts
- Reject malformed transaction data

✅ **Error Handling**
- Never expose secret keys in error messages
- Log errors securely (no sensitive data)
- Implement proper retry logic

✅ **Audit Trail**
- Log all escrow operations
- Maintain immutable audit logs
- Monitor for suspicious activity

### Pre-Production Checklist

- [ ] External security audit completed
- [ ] Penetration testing performed
- [ ] Key rotation procedures documented
- [ ] Incident response plan in place
- [ ] Insurance/liability coverage secured
- [ ] Legal review of smart contract logic
- [ ] Disaster recovery plan tested

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Development mode with watch |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run type-check` | TypeScript type checking |
| `npm run generate-keypair` | Generate new Stellar keypair |
| `npm run verify-account` | Verify account on network |

---

## 🛠️ Deployment Tools

### CLI Scripts

The `scripts/` directory contains deployment utilities:

#### Create Escrow Account

```bash
node scripts/create-escrow.js   --adopter GADOPTER...   --owner GOWNER...   --amount 500
```

#### Monitor Transaction

```bash
node scripts/monitor-tx.js   --hash 0x123abc...
```

#### Broadcast Transaction

```bash
node scripts/broadcast.js   --file transaction.json   --network testnet
```

#### Verify Event Anchoring

```bash
node scripts/verify-event.js   --hash sha256hash   --tx 0x456def...
```

---

## 🤝 Contributing

We welcome blockchain-focused contributions!

### Areas of Interest

- 🔐 **Escrow Optimizations** - Gas efficiency, feature enhancements
- 🛡️ **Security Hardening** - Vulnerability fixes, best practices
- 📚 **Documentation** - Examples, guides, API docs
- 🔧 **Tooling** - CLI utilities, monitoring dashboards

### Contribution Workflow

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/escrow-improvement`)
3. **Write tests** for new functionality
4. **Ensure all tests pass** (`npm test`)
5. **Lint your code** (`npm run lint`)
6. **Commit changes** (`git commit -m 'feat: improve escrow gas efficiency'`)
7. **Push to fork** (`git push origin feature/escrow-improvement`)
8. **Open Pull Request**

### Code Review Requirements

Pull requests affecting these areas require **2+ maintainer reviews**:

- Escrow logic (`src/escrow/`)
- Transaction signing (`src/transactions/signer.ts`)
- Key management (`src/accounts/keypair.ts`)
- Network submission (`src/transactions/submit.ts`)

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 🛡️ Audit & Security

### Security Audits

This SDK is **security-critical infrastructure** that handles:
- Private key operations
- Financial transactions
- Escrow fund management


### Known Limitations

- Stellar network downtime affects all operations
- Transaction fees subject to network congestion
- Testnet resets may clear historical data
- Time locks require network time synchronization

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built for transparent, trustworthy pet adoption
- Powered by [Stellar](https://stellar.org) blockchain technology
- Inspired by the need of reliable pet adoptioin in africa and in peer-to-peer custody agreements

---

## 🔗 Related Projects

- **Backend:** [petad-backend](https://github.com/amina69/PetAd-Backend) - NestJS API server
- **Frontend:** [petad-frontend](https://github.com/amina69/PetAd-Frontend) - React web app

---

## 📚 Further Reading

- [Stellar Documentation](https://developers.stellar.org/)
- [Stellar SDK Reference](https://stellar.github.io/js-stellar-sdk/)
- [Multisig Accounts Guide](https://developers.stellar.org/docs/encyclopedia/signatures-multisig)
- [Transaction Lifecycle](https://developers.stellar.org/docs/fundamentals-and-concepts/stellar-data-structures/operations-and-transactions)

---

**Made with ⛓️ by the PetAd Team**

*Building blockchain trust infrastructure, one escrow at a time.*
