import {
  Keypair,
  Operation,
  TransactionBuilder,
  Networks,
} from '@stellar/stellar-sdk';
import {
  generateAccount,
  createAccount,
  verifyAccount,
  configureMultisigAccount,
  mergeAccount,
  fundTestnetAccount,
} from '../../../src/accounts/operations';
import {
  ValidationError,
  AccountNotFoundError,
  FriendbotError,
  HorizonSubmitError,
  SdkError,
} from '../../../src/utils/errors';

jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    Keypair: {
      random: jest.fn(),
      fromSecret: jest.fn(),
    },
    Operation: {
      createAccount: jest.fn(),
      setOptions: jest.fn(),
      accountMerge: jest.fn(),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({
        sign: jest.fn(),
      }),
    })),
  };
});

describe('Account Operations', () => {
  const mockHorizonClient = {
    fetchBaseFee: jest.fn(),
    friendbot: jest.fn(),
    loadAccount: jest.fn(),
    submitTransaction: jest.fn(),
  };

  const VALID_G = 'GD6W6HIKYOTU6BFEA6C2Z3ZZ7O7S26SSO2N5UCO5E7U7V7V7V7V7V7V7';
  const VALID_S = 'SA6W6HIKYOTU6BFEA6C2Z3ZZ7O7S26SSO2N5UCO5E7U7V7V7V7V7V7V7';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateAccount', () => {
    it('generates a new keypair', () => {
      const mockKeypair = {
        publicKey: () => VALID_G,
        secret: () => VALID_S,
      };
      (Keypair.random as jest.Mock).mockReturnValue(mockKeypair);

      const result = generateAccount();
      expect(result).toEqual({ publicKey: VALID_G, secretKey: VALID_S });
    });

    it('wraps errors', () => {
      (Keypair.random as jest.Mock).mockImplementation(() => {
        throw new Error('Random failed');
      });
      expect(() => generateAccount()).toThrow(SdkError);
    });
  });

  describe('createAccount', () => {
    const options = { destination: VALID_G, startingBalance: '10' };

    it('throws ValidationError for invalid secret key', async () => {
      await expect(
        createAccount({
          horizonClient: mockHorizonClient as any,
          masterSecretKey: 'invalid',
          network: 'testnet',
          options,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('submits a createAccount transaction successfully', async () => {
      const mockKeypair = {
        publicKey: () => VALID_G,
        secret: () => VALID_S,
      };
      (Keypair.fromSecret as jest.Mock).mockReturnValue(mockKeypair);
      mockHorizonClient.loadAccount.mockResolvedValue({
        sequenceNumber: () => '1',
      });
      mockHorizonClient.fetchBaseFee.mockResolvedValue(100);
      mockHorizonClient.submitTransaction.mockResolvedValue({
        successful: true,
        hash: 'hash',
        ledger: 100,
      });

      const result = await createAccount({
        horizonClient: mockHorizonClient as any,
        masterSecretKey: VALID_S,
        network: 'testnet',
        options,
      });

      expect(result.successful).toBe(true);
      expect(Operation.createAccount).toHaveBeenCalledWith(options);
    });
  });

  describe('verifyAccount', () => {
    it('returns account info for existing account', async () => {
      const mockAccount = {
        accountId: () => VALID_G,
        balances: [{ asset_type: 'native', balance: '100' }],
        signers: [{ key: VALID_G, weight: 1 }],
        thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
        sequenceNumber: () => '123',
      };
      mockHorizonClient.loadAccount.mockResolvedValue(mockAccount);

      const result = await verifyAccount({
        horizonClient: mockHorizonClient as any,
        accountId: VALID_G,
      });

      expect(result.accountId).toBe(VALID_G);
      expect(result.exists).toBe(true);
    });

    it('wraps NotFoundError as AccountNotFoundError', async () => {
      const { NotFoundError } = jest.requireActual('@stellar/stellar-sdk');
      mockHorizonClient.loadAccount.mockRejectedValue(new NotFoundError('Account Not Found', { status: 404, data: {} }));

      await expect(
        verifyAccount({
          horizonClient: mockHorizonClient as any,
          accountId: VALID_G,
        })
      ).rejects.toThrow(AccountNotFoundError);
    });
  });

  describe('configureMultisigAccount', () => {
    it('submits a setOptions transaction', async () => {
      const mockKeypair = {
        publicKey: () => VALID_G,
        secret: () => VALID_S,
      };
      (Keypair.fromSecret as jest.Mock).mockReturnValue(mockKeypair);
      mockHorizonClient.loadAccount.mockResolvedValue({ sequenceNumber: () => '1' });
      mockHorizonClient.fetchBaseFee.mockResolvedValue(100);
      mockHorizonClient.submitTransaction.mockResolvedValue({ successful: true });

      const options = {
        sourceSecretKey: VALID_S,
        signerPublicKey: VALID_G,
        signerWeight: 1,
      };

      await configureMultisigAccount({
        horizonClient: mockHorizonClient as any,
        network: 'public',
        options,
      });

      expect(Operation.setOptions).toHaveBeenCalled();
    });
  });

  describe('mergeAccount', () => {
    it('submits an accountMerge transaction', async () => {
      const mockKeypair = {
        publicKey: () => VALID_G,
        secret: () => VALID_S,
      };
      (Keypair.fromSecret as jest.Mock).mockReturnValue(mockKeypair);
      mockHorizonClient.loadAccount.mockResolvedValue({ sequenceNumber: () => '1' });
      mockHorizonClient.fetchBaseFee.mockResolvedValue(100);
      mockHorizonClient.submitTransaction.mockResolvedValue({ successful: true });

      await mergeAccount({
        horizonClient: mockHorizonClient as any,
        network: 'testnet',
        options: { sourceSecretKey: VALID_S, destination: VALID_G },
      });

      expect(Operation.accountMerge).toHaveBeenCalledWith({ destination: VALID_G });
    });
  });

  describe('fundTestnetAccount', () => {
    it('calls friendbot', async () => {
      mockHorizonClient.friendbot.mockReturnValue({
        call: jest.fn().mockResolvedValue({}),
      });

      await fundTestnetAccount({
        horizonClient: mockHorizonClient as any,
        publicKey: VALID_G,
      });

      expect(mockHorizonClient.friendbot).toHaveBeenCalledWith(VALID_G);
    });

    it('wraps NetworkError from friendbot', async () => {
      const { NetworkError } = jest.requireActual('@stellar/stellar-sdk');
      const mockError = new NetworkError('Friendbot failed');
      mockError.getResponse = () => ({ status: 400, data: { title: 'Bad Request' } } as any);
      
      mockHorizonClient.friendbot.mockReturnValue({
        call: jest.fn().mockRejectedValue(mockError),
      });

      await expect(
        fundTestnetAccount({
          horizonClient: mockHorizonClient as any,
          publicKey: VALID_G,
        })
      ).rejects.toThrow(FriendbotError);
    });
  });

  describe('wrapSdkError', () => {
    it('handles Horizon transaction failure', async () => {
       const { NetworkError } = jest.requireActual('@stellar/stellar-sdk');
       const mockError = new NetworkError('Transaction failed');
       mockError.getResponse = () => ({
         status: 400,
         data: {
           title: 'Transaction Failed',
           extras: {
             result_codes: {
               transaction: 'tx_failed',
               operations: ['op_failed']
             }
           }
         }
       } as any);

       mockHorizonClient.loadAccount.mockResolvedValue({ sequenceNumber: () => '1' });
       mockHorizonClient.submitTransaction.mockRejectedValue(mockError);

       await expect(createAccount({
         horizonClient: mockHorizonClient as any,
         masterSecretKey: VALID_S,
         network: 'testnet',
         options: { destination: VALID_G, startingBalance: '10' }
       })).rejects.toThrow(HorizonSubmitError);
    });

    it('returns generic SdkError for unknown errors', async () => {
      mockHorizonClient.loadAccount.mockRejectedValue(new Error('Unknown'));
      await expect(verifyAccount({
        horizonClient: mockHorizonClient as any,
        accountId: VALID_G
      })).rejects.toThrow(SdkError);
    });
  });
});
