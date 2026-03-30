import { Horizon } from '@stellar/stellar-sdk';
import { StellarSDK } from '../../src/sdk';
import { TransactionManager } from '../../src/transactions';
import { DEFAULT_MAX_FEE, DEFAULT_TRANSACTION_TIMEOUT } from '../../src/utils/constants';

// Mock the TransactionManager
jest.mock('../../src/transactions');

describe('StellarSDK', () => {
  let mockHorizonClient: jest.Mocked<Horizon.Server>;

  beforeEach(() => {
    mockHorizonClient = {
      serverURL: 'https://horizon-testnet.stellar.org'
    } as unknown as jest.Mocked<Horizon.Server>;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      const config = {
        horizonClient: mockHorizonClient,
        maxFee: 5000,
        transactionTimeout: 120
      };

      const sdk = new StellarSDK(config);

      expect(sdk).toBeInstanceOf(StellarSDK);
      expect(sdk.transactions).toBeInstanceOf(TransactionManager);
      expect(TransactionManager).toHaveBeenCalledWith({
        horizonClient: mockHorizonClient,
        maxFee: 5000,
        transactionTimeout: 120
      });
    });

    it('should use default values when not provided', () => {
      const config = {
        horizonClient: mockHorizonClient
      };

      const sdk = new StellarSDK(config);

      expect(sdk).toBeInstanceOf(StellarSDK);
      expect(sdk.transactions).toBeInstanceOf(TransactionManager);
      expect(TransactionManager).toHaveBeenCalledWith({
        horizonClient: mockHorizonClient,
        maxFee: DEFAULT_MAX_FEE,
        transactionTimeout: DEFAULT_TRANSACTION_TIMEOUT
      });
    });

    it('should expose transactions property', () => {
      const config = {
        horizonClient: mockHorizonClient
      };

      const sdk = new StellarSDK(config);

      expect(sdk.transactions).toBeDefined();
      expect(sdk.transactions).toBeInstanceOf(TransactionManager);
    });
  });

  describe('integration', () => {
    it('should provide access to transaction operations through transactions property', () => {
      const config = {
        horizonClient: mockHorizonClient,
        maxFee: 8000,
        transactionTimeout: 300
      };

      const sdk = new StellarSDK(config);

      // Verify that the TransactionManager was created with the correct config
      expect(TransactionManager).toHaveBeenCalledWith({
        horizonClient: mockHorizonClient,
        maxFee: 8000,
        transactionTimeout: 300
      });

      // Verify that the transactions property is accessible
      expect(sdk.transactions).toBeDefined();
    });
  });
});