export interface SubmitResult {
  successful: boolean;
  hash: string;
  ledger: number;
}

export interface TransactionStatus {
  confirmed: boolean;
  confirmations: number;
  ledger: number;
  hash: string;
  successful: boolean;
}
