export interface PaymentOp {
  type: 'Payment';
  destination: string;
  asset: string;
  amount: string;
}

export interface CreateAccountOp {
  type: 'CreateAccount';
  destination: string;
  startingBalance: string;
}

export interface SetOptionsOp {
  type: 'SetOptions';
  inflationDest?: string;
  clearFlags?: number;
  setFlags?: number;
  masterWeight?: number;
  lowThreshold?: number;
  medThreshold?: number;
  highThreshold?: number;
  homeDomain?: string;
  signer?: {
    ed25519PublicKey?: string;
    sha256Hash?: Buffer | string;
    preAuthTx?: Buffer | string;
    weight: number;
  };
}

export interface AccountMergeOp {
  type: 'AccountMerge';
  destination: string;
}

export interface ManageDataOp {
  type: 'ManageData';
  name: string;
  value: string | Buffer | Uint8Array | null;
}

export type Operation =
  | PaymentOp
  | CreateAccountOp
  | SetOptionsOp
  | AccountMergeOp
  | ManageDataOp;

export interface BuildParams {
  sourceAccount: string;
  operations: Operation[];
  memo?: string;
  fee?: string;
  timeoutSeconds?: number;
}

export interface SubmitResult {
  successful: boolean;
  hash: string;
  ledger: number;
  resultXdr?: string;
}

export interface TransactionStatus {
  confirmed: boolean;
  confirmations: number;
  ledger: number;
  hash: string;
  successful: boolean;
}
