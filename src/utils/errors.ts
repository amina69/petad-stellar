export class SdkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends SdkError {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message, 'VALIDATION_ERROR', false);
  }
}

export class AccountNotFoundError extends SdkError {
  constructor(public readonly accountId: string) {
    super(`Account not found: ${accountId}`, 'ACCOUNT_NOT_FOUND', false);
  }
}

export class EscrowNotFoundError extends SdkError {
  constructor(public readonly escrowAccountId: string) {
    super(`Escrow not found: ${escrowAccountId}`, 'ESCROW_NOT_FOUND', false);
  }
}

export class InsufficientBalanceError extends SdkError {
  constructor(required: string, available: string) {
    super(
      `Insufficient balance. Required: ${required}, available: ${available}`,
      'INSUFFICIENT_BALANCE',
      false,
    );
  }
}

export class HorizonSubmitError extends SdkError {
  constructor(
    public readonly resultCode: string,
    public readonly operationCodes: string[] = [],
  ) {
    const retryable = ['tx_bad_seq', 'timeout'].includes(resultCode);
    super(`Transaction failed: ${resultCode}`, 'HORIZON_SUBMIT_ERROR', retryable);
  }
}

export class TransactionTimeoutError extends SdkError {
  constructor(public readonly txHash: string) {
    super(`Transaction timed out: ${txHash}`, 'TRANSACTION_TIMEOUT', true);
  }
}

export class MonitorTimeoutError extends SdkError {
  constructor(
    public readonly txHash: string,
    public readonly attempts: number,
  ) {
    super(`Monitor timed out after ${attempts} attempts: ${txHash}`, 'MONITOR_TIMEOUT', true);
  }
}

export class FriendbotError extends SdkError {
  constructor(
    public readonly publicKey: string,
    statusCode: number,
  ) {
    super(`Friendbot failed for ${publicKey}: HTTP ${statusCode}`, 'FRIENDBOT_ERROR', true);
  }
}

export class ConditionMismatchError extends SdkError {
  constructor(
    public readonly stored: string,
    public readonly computed: string,
  ) {
    super('Custody conditions do not match stored hash', 'CONDITION_MISMATCH', false);
  }
}
