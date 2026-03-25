# Changelog

## [Unreleased]

### Added
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
  <!-- sdk-ci.yml -->
  <!-- also create develop  branch -->
