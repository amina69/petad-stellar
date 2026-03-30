# Changelog

## [Unreleased]

### Fixed
- Fixed TypeScript linting errors in test files by replacing `any` type assertions with proper `@ts-expect-error` comments for mock implementations
- Improved test coverage to meet contribution requirements (functions ≥95%, branches ≥90%, lines ≥90%)
- Added comprehensive export tests to ensure all public API functions are properly tested from the main entry point

### Added
- `isValidAmount()` validator: validates positive Stellar amount strings with up to 7 decimal places and rejects scientific notation (`src/utils/validation.ts`)
- `EscrowManager` class with dependency-injected escrow lifecycle methods: `createAccount`, `lockFunds`, `releaseFunds`, `handleDispute`, `getBalance`, and `getStatus` (`src/escrow/index.ts`)
- Consistent escrow manager error wrapping for non-SDK errors using `ESCROW_MANAGER_ERROR` (`src/escrow/index.ts`)
- Unit tests for escrow manager instantiation and method delegation (`tests/unit/escrow/escrowManager.test.ts`)
- `getMinimumReserve()` utility to calculate the minimum XLM balance required for an account based on signers, offers, and trustlines (`src/accounts/keypair.ts`)
- `Percentage` branded type: compile-time guarantee that a number is validated to [0, 100] (`src/types/escrow.ts`)
- `asPercentage()` runtime guard: validates and casts a number to `Percentage`, throws `RangeError` on NaN, Infinity, or out-of-range values (`src/types/escrow.ts`)
- `Distribution` type: `recipient: string`, `percentage: Percentage` (`src/types/escrow.ts`)
- `ReleaseParams` type: `escrowAccountId: string`, `distribution: Distribution[]` (`src/types/escrow.ts`)
- `ReleasedPayment` type: `recipient: string`, `amount: string` (`src/types/escrow.ts`)
- `ReleaseResult` type: `successful`, `txHash`, `ledger`, `payments: ReleasedPayment[]` (`src/types/escrow.ts`)
- Unit tests for all escrow release types in `tests/unit/types/escrow.test.ts`
- `BuildParams` type: `sourceAccount`, `operations`, optional `memo`, `fee`, `timeoutSeconds` (`src/types/transaction.ts`)
- `Operation` union type: `PaymentOp | CreateAccountOp | SetOptionsOp | AccountMergeOp | ManageDataOp` (`src/types/transaction.ts`)
- `SubmitResult` type: `successful`, `hash`, `ledger`, `resultXdr` (`src/types/transaction.ts`)
- `TransactionStatus` type: `confirmed`, `confirmations`, `ledger`, `hash`, `successful` (`src/types/transaction.ts`)
- Re-exported all transaction types from `src/types/index.ts`

## [0.1.0] - 2026-03-23

### Added

- Initial project scaffold
- Logger class in src/utils/logger.ts with redaction, log levels, and JSON output
- Unit tests for logger redaction and log level filtering
- GitHub Actions CI workflow: lint, unit tests, build, security audit, npm publish on tag


### Added
- `lockCustodyFunds()` implementation for escrow lifecycle:
  - Validates custodian, owner, platform public keys, deposit amount, and duration
  - Computes deterministic `conditionsHash` using SHA-256
  - Calculates `unlockDate` based on duration
  - Builds and submits Stellar transaction to create escrow account
  - Sets multi-sig signers (custodian, owner, platform)
  - Encodes conditionsHash in transaction memo
  - Returns `LockResult` with unlockDate, conditionsHash, escrowPublicKey, and transactionHash
- Unit tests for `lockCustodyFunds()` including happy path, validation errors, deterministic hashing, unlock date, and edge cases
  <!-- sdk-ci.yml -->
  <!-- also create develop  branch -->
