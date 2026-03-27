import * as StellarSdk from '@stellar/stellar-sdk';
import { mergeAccount, TrustlineError } from '../../../src/accounts/merge';
import { ValidationError } from '../../../src/utils/errors';

// Generate valid Stellar keypairs for testing
const masterKeypair = StellarSdk.Keypair.random();
const escrowKeypair = StellarSdk.Keypair.random();
const destinationKeypair = StellarSdk.Keypair.random();

const MASTER_SECRET = masterKeypair.secret();
const ESCROW_PUBLIC = escrowKeypair.publicKey();
const DESTINATION_PUBLIC = destinationKeypair.publicKey();
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

// Mock the Stellar SDK Horizon server
jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    Horizon: {
      ...actual.Horizon,
      Server: jest.fn(),
    },
  };
});

describe('mergeAccount', () => {
  let mockServer: {
    loadAccount: jest.Mock;
    submitTransaction: jest.Mock;
  };

  beforeEach(() => {
    mockServer = {
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
    };
    (StellarSdk.Horizon.Server as unknown as jest.Mock).mockImplementation(() => mockServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should validate escrowAccountId', async () => {
    await expect(
      mergeAccount(
        { escrowAccountId: 'invalid', destinationAccountId: DESTINATION_PUBLIC },
        MASTER_SECRET,
        HORIZON_URL,
        NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should validate destinationAccountId', async () => {
    await expect(
      mergeAccount(
        { escrowAccountId: ESCROW_PUBLIC, destinationAccountId: 'invalid' },
        MASTER_SECRET,
        HORIZON_URL,
        NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should validate masterSecretKey', async () => {
    await expect(
      mergeAccount(
        { escrowAccountId: ESCROW_PUBLIC, destinationAccountId: DESTINATION_PUBLIC },
        'invalid',
        HORIZON_URL,
        NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw TrustlineError when escrow has non-native trustlines', async () => {
    mockServer.loadAccount.mockResolvedValue({
      accountId: () => ESCROW_PUBLIC,
      sequenceNumber: () => '1',
      balances: [
        { asset_type: 'native', balance: '100' },
        { asset_type: 'credit_alphanum4', balance: '50', asset_code: 'USD', asset_issuer: DESTINATION_PUBLIC },
      ],
      incrementSequenceNumber: jest.fn(),
    });

    await expect(
      mergeAccount(
        { escrowAccountId: ESCROW_PUBLIC, destinationAccountId: DESTINATION_PUBLIC },
        MASTER_SECRET,
        HORIZON_URL,
        NETWORK_PASSPHRASE,
      ),
    ).rejects.toThrow(TrustlineError);
  });

  it('should merge account and return correct result', async () => {
    const mockAccount = new StellarSdk.Account(ESCROW_PUBLIC, '1');
    Object.assign(mockAccount, {
      balances: [{ asset_type: 'native', balance: '100' }],
    });

    mockServer.loadAccount.mockResolvedValue(mockAccount);
    mockServer.submitTransaction.mockResolvedValue({
      hash: 'abc123txhash',
      ledger: 42,
    });

    const result = await mergeAccount(
      { escrowAccountId: ESCROW_PUBLIC, destinationAccountId: DESTINATION_PUBLIC },
      MASTER_SECRET,
      HORIZON_URL,
      NETWORK_PASSPHRASE,
    );

    expect(result.mergedAccountId).toBe(ESCROW_PUBLIC);
    expect(result.txHash).toBe('abc123txhash');
    expect(mockServer.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('should set correct merge destination in the transaction', async () => {
    const mockAccount = new StellarSdk.Account(ESCROW_PUBLIC, '1');
    Object.assign(mockAccount, {
      balances: [{ asset_type: 'native', balance: '100' }],
    });

    mockServer.loadAccount.mockResolvedValue(mockAccount);
    mockServer.submitTransaction.mockResolvedValue({
      hash: 'txhash456',
      ledger: 50,
    });

    await mergeAccount(
      { escrowAccountId: ESCROW_PUBLIC, destinationAccountId: DESTINATION_PUBLIC },
      MASTER_SECRET,
      HORIZON_URL,
      NETWORK_PASSPHRASE,
    );

    // Verify the transaction was submitted with the correct destination
    const submittedTx = mockServer.submitTransaction.mock.calls[0][0] as StellarSdk.Transaction;
    expect(submittedTx.operations).toHaveLength(1);
    expect(submittedTx.operations[0].type).toBe('accountMerge');
    expect((submittedTx.operations[0] as StellarSdk.Operation.AccountMerge).destination).toBe(DESTINATION_PUBLIC);
  });
});
