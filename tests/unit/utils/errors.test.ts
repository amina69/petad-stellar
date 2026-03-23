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
});
