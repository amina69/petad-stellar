import { AccountManager } from '../../../src/accounts';
import * as accountOperations from '../../../src/accounts/operations';

jest.mock('../../../src/accounts/operations', () => ({
  configureMultisigAccount: jest.fn(),
  createAccount: jest.fn(),
  fundTestnetAccount: jest.fn(),
  generateAccount: jest.fn(),
  mergeAccount: jest.fn(),
  verifyAccount: jest.fn(),
}));

describe('AccountManager', () => {
  const horizonClient = {
    fetchBaseFee: jest.fn(),
    friendbot: jest.fn(),
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  const config = {
    horizonClient,
    masterSecretKey: 'SMASTER111111111111111111111111111111111111111111111111',
    network: 'testnet' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores injected configuration on instantiation', () => {
    const manager = new AccountManager(config);

    expect(manager).toBeInstanceOf(AccountManager);
  });

  it('delegates generate', () => {
    const expected = { publicKey: 'GTEST', secretKey: 'STEST' };
    (accountOperations.generateAccount as jest.Mock).mockReturnValue(expected);
    const manager = new AccountManager(config);

    expect(manager.generate()).toBe(expected);
    expect(accountOperations.generateAccount).toHaveBeenCalledTimes(1);
  });

  it('delegates create', async () => {
    const options = { destination: 'GDEST', startingBalance: '10' };
    const expected = { successful: true, hash: 'hash', ledger: 1 };
    (accountOperations.createAccount as jest.Mock).mockResolvedValue(expected);
    const manager = new AccountManager(config);

    await expect(manager.create(options)).resolves.toEqual(expected);
    expect(accountOperations.createAccount).toHaveBeenCalledWith({
      horizonClient,
      masterSecretKey: config.masterSecretKey,
      network: config.network,
      options,
    });
  });

  it('delegates verify', async () => {
    const expected = {
      accountId: 'GACCOUNT',
      balance: '100',
      signers: [],
      thresholds: { low: 1, medium: 2, high: 3 },
      sequenceNumber: '123',
      exists: true,
    };
    (accountOperations.verifyAccount as jest.Mock).mockResolvedValue(expected);
    const manager = new AccountManager(config);

    await expect(manager.verify('GACCOUNT')).resolves.toEqual(expected);
    expect(accountOperations.verifyAccount).toHaveBeenCalledWith({
      horizonClient,
      accountId: 'GACCOUNT',
    });
  });

  it('delegates configureMultisig', async () => {
    const options = {
      sourceSecretKey: 'SSOURCE',
      signerPublicKey: 'GSIGNER',
      signerWeight: 1,
      lowThreshold: 1,
      mediumThreshold: 2,
      highThreshold: 2,
    };
    const expected = { successful: true, hash: 'hash', ledger: 2 };
    (accountOperations.configureMultisigAccount as jest.Mock).mockResolvedValue(expected);
    const manager = new AccountManager(config);

    await expect(manager.configureMultisig(options)).resolves.toEqual(expected);
    expect(accountOperations.configureMultisigAccount).toHaveBeenCalledWith({
      horizonClient,
      network: config.network,
      options,
    });
  });

  it('delegates merge', async () => {
    const options = { sourceSecretKey: 'SSOURCE', destination: 'GDEST' };
    const expected = { successful: true, hash: 'hash', ledger: 3 };
    (accountOperations.mergeAccount as jest.Mock).mockResolvedValue(expected);
    const manager = new AccountManager(config);

    await expect(manager.merge(options)).resolves.toEqual(expected);
    expect(accountOperations.mergeAccount).toHaveBeenCalledWith({
      horizonClient,
      network: config.network,
      options,
    });
  });

  it('delegates fundTestnet', async () => {
    (accountOperations.fundTestnetAccount as jest.Mock).mockResolvedValue(undefined);
    const manager = new AccountManager(config);

    await expect(manager.fundTestnet('GFUND')).resolves.toBeUndefined();
    expect(accountOperations.fundTestnetAccount).toHaveBeenCalledWith({
      horizonClient,
      publicKey: 'GFUND',
    });
  });
});
