import { Account, Keypair, NotFoundError } from '@stellar/stellar-sdk';
import { createAccount } from '../../../src/accounts';
import { SDKConfig } from '../../../src/types/network';
import { AccountNotFoundError, HorizonSubmitError, ValidationError } from '../../../src/utils/errors';

const destinationKeypair = Keypair.random();
const masterKeypair = Keypair.random();
const VALID_PUBLIC_KEY = destinationKeypair.publicKey();

const baseConfig: SDKConfig = {
  network: 'testnet',
  horizonUrl: 'http://mock-horizon.test',
  masterSecretKey: masterKeypair.secret(),
};

describe('createAccount', () => {
  it('creates and funds a new account', async () => {
    const horizonClient = {
      loadAccount: jest.fn().mockResolvedValue(new Account(masterKeypair.publicKey(), '123456789')),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockResolvedValue({
        hash: 'abc123',
      }),
    };

    await expect(createAccount({ publicKey: VALID_PUBLIC_KEY }, baseConfig, horizonClient)).resolves.toEqual({
      accountId: VALID_PUBLIC_KEY,
      transactionHash: 'abc123',
      startingBalance: '2.5',
    });

    expect(horizonClient.loadAccount).toHaveBeenCalledTimes(1);
    expect(horizonClient.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('throws ValidationError for an invalid key', async () => {
    const horizonClient = {
      loadAccount: jest.fn(),
      fetchBaseFee: jest.fn(),
      submitTransaction: jest.fn(),
    };

    await expect(createAccount({ publicKey: 'BAD_KEY' }, baseConfig, horizonClient)).rejects.toBeInstanceOf(ValidationError);
    expect(horizonClient.loadAccount).not.toHaveBeenCalled();
  });

  it('throws AccountNotFoundError if the master account is missing', async () => {
    const horizonClient = {
      loadAccount: jest.fn().mockRejectedValue(new NotFoundError('missing', { status: 404 })),
      fetchBaseFee: jest.fn(),
      submitTransaction: jest.fn(),
    };

    await expect(createAccount({ publicKey: VALID_PUBLIC_KEY }, baseConfig, horizonClient)).rejects.toBeInstanceOf(AccountNotFoundError);
  });

  it('throws HorizonSubmitError when the master balance is insufficient', async () => {
    const horizonClient = {
      loadAccount: jest.fn().mockResolvedValue(new Account(masterKeypair.publicKey(), '123456789')),
      fetchBaseFee: jest.fn().mockResolvedValue(100),
      submitTransaction: jest.fn().mockRejectedValue(new Error('op_underfunded')),
    };

    await expect(
      createAccount({ publicKey: VALID_PUBLIC_KEY, startingBalance: '5.0' }, baseConfig, horizonClient),
    ).rejects.toBeInstanceOf(HorizonSubmitError);
  });
});
