import defaultExport, {
  StellarSDK,
  SdkError,
  ValidationError,
  AccountNotFoundError,
  EscrowNotFoundError,
  InsufficientBalanceError,
  HorizonSubmitError,
  TransactionTimeoutError,
  MonitorTimeoutError,
  FriendbotError,
  ConditionMismatchError,
  EscrowStatus,
} from '../../src/index';

describe('SDK Exports', () => {
  it('should export StellarSDK', () => {
    expect(StellarSDK).toBeDefined();
  });

  it('should export all error classes', () => {
    expect(SdkError).toBeDefined();
    expect(ValidationError).toBeDefined();
    expect(AccountNotFoundError).toBeDefined();
    expect(EscrowNotFoundError).toBeDefined();
    expect(InsufficientBalanceError).toBeDefined();
    expect(HorizonSubmitError).toBeDefined();
    expect(TransactionTimeoutError).toBeDefined();
    expect(MonitorTimeoutError).toBeDefined();
    expect(FriendbotError).toBeDefined();
    expect(ConditionMismatchError).toBeDefined();
  });

  it('should export EscrowStatus enum', () => {
    expect(EscrowStatus).toBeDefined();
    expect(EscrowStatus.CREATED).toBe('CREATED');
  });

  it('should have a default export', () => {
    expect(defaultExport).toBeDefined();
    expect(defaultExport.SDK_VERSION).toBeDefined();
  });
});
