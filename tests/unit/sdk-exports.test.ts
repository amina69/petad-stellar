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

// Requirements 1.3
describe('StellarSDK named and default export identity', () => {
  it('default export and named StellarSDK export are the same reference', () => {
    expect(defaultExport).toBe(StellarSDK);
  });
});

// Requirements 2.1–2.10
describe('Error class exports are instantiable from the entry point', () => {
  it('SdkError is exported and instantiable', () => {
    const err = new SdkError('msg', 'CODE');
    expect(err).toBeInstanceOf(SdkError);
    expect(err).toBeInstanceOf(Error);
  });

  it('ValidationError is exported and instantiable', () => {
    const err = new ValidationError('field', 'msg');
    expect(err).toBeInstanceOf(ValidationError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('AccountNotFoundError is exported and instantiable', () => {
    const err = new AccountNotFoundError('GTEST');
    expect(err).toBeInstanceOf(AccountNotFoundError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('EscrowNotFoundError is exported and instantiable', () => {
    const err = new EscrowNotFoundError('GTEST');
    expect(err).toBeInstanceOf(EscrowNotFoundError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('InsufficientBalanceError is exported and instantiable', () => {
    const err = new InsufficientBalanceError('10', '5');
    expect(err).toBeInstanceOf(InsufficientBalanceError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('HorizonSubmitError is exported and instantiable', () => {
    const err = new HorizonSubmitError('tx_bad_seq');
    expect(err).toBeInstanceOf(HorizonSubmitError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('TransactionTimeoutError is exported and instantiable', () => {
    const err = new TransactionTimeoutError('hash123');
    expect(err).toBeInstanceOf(TransactionTimeoutError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('MonitorTimeoutError is exported and instantiable', () => {
    const err = new MonitorTimeoutError('hash123', 3);
    expect(err).toBeInstanceOf(MonitorTimeoutError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('FriendbotError is exported and instantiable', () => {
    const err = new FriendbotError('GTEST', 400);
    expect(err).toBeInstanceOf(FriendbotError);
    expect(err).toBeInstanceOf(SdkError);
  });

  it('ConditionMismatchError is exported and instantiable', () => {
    const err = new ConditionMismatchError('stored', 'computed');
    expect(err).toBeInstanceOf(ConditionMismatchError);
    expect(err).toBeInstanceOf(SdkError);
  });
});

// Requirements 4.2
describe('EscrowStatus enum values resolve to their expected string literals', () => {
  it('EscrowStatus.CREATED === "CREATED"', () => {
    expect(EscrowStatus.CREATED).toBe('CREATED');
  });

  it('EscrowStatus.FUNDED === "FUNDED"', () => {
    expect(EscrowStatus.FUNDED).toBe('FUNDED');
  });

  it('EscrowStatus.DISPUTED === "DISPUTED"', () => {
    expect(EscrowStatus.DISPUTED).toBe('DISPUTED');
  });

  it('EscrowStatus.SETTLING === "SETTLING"', () => {
    expect(EscrowStatus.SETTLING).toBe('SETTLING');
  });

  it('EscrowStatus.SETTLED === "SETTLED"', () => {
    expect(EscrowStatus.SETTLED).toBe('SETTLED');
  });

  it('EscrowStatus.NOT_FOUND === "NOT_FOUND"', () => {
    expect(EscrowStatus.NOT_FOUND).toBe('NOT_FOUND');
  });
});
