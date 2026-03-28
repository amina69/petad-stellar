import {
  SdkError, ValidationError, AccountNotFoundError,
  HorizonSubmitError, TransactionTimeoutError,
} from '../../../src/utils/errors';

describe('SdkError hierarchy', () => {
  it('ValidationError is a SdkError', () => {
    const err = new ValidationError('publicKey', 'Invalid key');
    expect(err).toBeInstanceOf(SdkError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.retryable).toBe(false);
    expect(err.field).toBe('publicKey');
  });

  it('AccountNotFoundError carries accountId', () => {
    const err = new AccountNotFoundError('GTEST...');
    expect(err.accountId).toBe('GTEST...');
    expect(err.retryable).toBe(false);
  });

  it('HorizonSubmitError is retryable for tx_bad_seq', () => {
    const err = new HorizonSubmitError('tx_bad_seq');
    expect(err.retryable).toBe(true);
  });

  it('HorizonSubmitError is NOT retryable for tx_bad_auth', () => {
    const err = new HorizonSubmitError('tx_bad_auth');
    expect(err.retryable).toBe(false);
  });

  it('TransactionTimeoutError is retryable', () => {
    const err = new TransactionTimeoutError('abc123');
    expect(err.retryable).toBe(true);
  });

  it('EscrowNotFoundError carries escrowAccountId', async () => {
    const { EscrowNotFoundError } = await import('../../../src/utils/errors');
    const err = new EscrowNotFoundError('GESCROW...');
    expect(err.escrowAccountId).toBe('GESCROW...');
    expect(err.code).toBe('ESCROW_NOT_FOUND');
  });

  it('InsufficientBalanceError formats required/available', async () => {
    const { InsufficientBalanceError } = await import('../../../src/utils/errors');
    const err = new InsufficientBalanceError('10', '9');
    expect(err.code).toBe('INSUFFICIENT_BALANCE');
    expect(err.message).toContain('Required: 10');
    expect(err.message).toContain('available: 9');
  });

  it('MonitorTimeoutError is retryable and includes attempts', async () => {
    const { MonitorTimeoutError } = await import('../../../src/utils/errors');
    const err = new MonitorTimeoutError('txhash', 5);
    expect(err.retryable).toBe(true);
    expect(err.attempts).toBe(5);
    expect(err.message).toContain('after 5 attempts');
  });

  it('FriendbotError is retryable and includes status code', async () => {
    const { FriendbotError } = await import('../../../src/utils/errors');
    const err = new FriendbotError('GPUB...', 429);
    expect(err.retryable).toBe(true);
    expect(err.code).toBe('FRIENDBOT_ERROR');
    expect(err.message).toContain('HTTP 429');
  });

  it('ConditionMismatchError has stable code and message', async () => {
    const { ConditionMismatchError } = await import('../../../src/utils/errors');
    const err = new ConditionMismatchError('stored', 'computed');
    expect(err.code).toBe('CONDITION_MISMATCH');
    expect(err.retryable).toBe(false);
    expect(err.message).toContain('Custody conditions do not match');
  });
});
