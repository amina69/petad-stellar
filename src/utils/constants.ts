// export const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org';
// export const MAINNET_HORIZON_URL = 'https://horizon.stellar.org';
// export const TESTNET_PASSPHRASE  = 'Test SDF Network ; September 2015';
// export const MAINNET_PASSPHRASE  = 'Public Global Stellar Network ; September 2015';
// export const BASE_RESERVE_XLM            = 0.5;
// export const DEFAULT_TRANSACTION_TIMEOUT = 180;
// export const DEFAULT_MAX_FEE             = 10000;
// export const DEFAULT_CONFIRMATION_DEPTH  = 3;



/** Stellar testnet network passphrase — same for every developer, never changes */
export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

/** Stellar mainnet network passphrase — used in production with real XLM */
export const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

/** Horizon API URL for testnet — free public endpoint for development */
export const TESTNET_HORIZON_URL = 'https://horizon-testnet.stellar.org';

/** Horizon API URL for mainnet — free public endpoint for production */
export const MAINNET_HORIZON_URL = 'https://horizon.stellar.org';

/**
 * Base reserve per subentry in XLM.
 * Stellar requires every account to hold a minimum balance.
 * Formula: BASE_RESERVE * (2 + numSubentries)
 * A subentry is a signer, trustline, offer, or data entry.
 */
export const BASE_RESERVE_XLM = 0.5;

/**
 * Minimum XLM balance for a plain account with no subentries.
 * Formula: BASE_RESERVE * 2 = 0.5 * 2 = 1.0 XLM
 */
export const MIN_ACCOUNT_BALANCE_XLM = 1.0;

/**
 * Default transaction timeout in seconds.
 * After this time an unsubmitted transaction expires and cannot be submitted.
 * 180 seconds = 3 minutes.
 */
export const DEFAULT_TRANSACTION_TIMEOUT = 180;

/**
 * Default maximum fee per operation in stroops.
 * 1 XLM = 10,000,000 stroops.
 * 10000 stroops = 0.001 XLM per operation.
 */
export const DEFAULT_MAX_FEE = 10000;

/**
 * Minimum number of ledger confirmations before treating a transaction as final.
 * Each Stellar ledger closes approximately every 5 seconds.
 * 3 confirmations = roughly 15 seconds after submission.
 */
export const DEFAULT_CONFIRMATION_DEPTH = 3;