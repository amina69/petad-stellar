/**
 * Minimal Horizon account response shape consumed by getEscrowStatus().
 * Full spec: https://developers.stellar.org/api/horizon/resources/accounts
 */
export interface HorizonSigner {
  key: string;
  weight: number;
  type: string;
}

export interface HorizonBalance {
  /** "native" for XLM, asset code otherwise. */
  asset_type: string;
  balance: string; // decimal string, e.g. "25.0000000"
}

export interface HorizonAccountResponse {
  id: string;
  account_id: string;
  signers: HorizonSigner[];
  balances: HorizonBalance[];
  /** Stellar minimum reserve depends on sub-entry count. */
  subentry_count: number;
}

/** Shape thrown / returned when Horizon responds with a non-200. */
export interface HorizonErrorResponse {
  status: number;
  title: string;
  detail: string;
}