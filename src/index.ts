import * as StellarSDK from '@stellar/stellar-sdk';
export { StellarSDK };

export const SDK_VERSION = '0.1.0';

export { verifyAccount } from './accounts';

export * from './utils/errors';
export * from './utils/validation';

export { EscrowStatus } from './types/escrow';
export type {
  CreateEscrowParams,
  Signer,
  Thresholds,
  EscrowAccount,
} from './types/escrow';

export type { AccountInfo } from './types/network';

// Default export for convenience
export default {
  SDK_VERSION,
  StellarSDK,
};
