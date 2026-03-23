# Contributing

## Rules

0. Create branch from develop and always make PR to develop not masters
1. Every new public function needs tests: happy path, validation, errors, idempotency, edge cases.
2. `npm run test:cov` must pass (lines ≥90%, branches ≥90%, functions ≥95%) before opening a PR.
3. `npm run lint` and `npm run type-check` must be clean.
4. Update CHANGELOG.md under ## [Unreleased] for every PR.
5. Never put a secret key in src/ — CI will block the PR.

## Commands

    npm test                    unit tests
    npm run test:cov            with coverage
    npm run test:watch          watch mode
    npm run test:integration    testnet (needs .env)
    npm run lint                check for errors
    npm run build               compile to dist/
