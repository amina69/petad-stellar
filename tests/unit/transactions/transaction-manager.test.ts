import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Horizon, Keypair, Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { 
  TransactionManager, 
  buildTransaction, 
  signTransaction, 
  submitTransaction, 
  estimateTransactionFee, 
  transactionToXDR, 
  transactionFromXDR 
} from '../../../src/transactions';
import { BuildParams } from '../../../src/types/transaction';
import { DEFAULT_MAX_FEE } from '../../../src/utils/constants';

// Mock the Stellar SDK
jest.mock('@stellar/stellar-sdk', () => ({
  ...(jest.requireActual('@stellar/stellar-sdk') as object),
  TransactionBuilder: jest.fn(),
  Transaction: jest.fn(),
}));

const MockedTransactionBuilder = TransactionBuilder as jest.MockedClass<typeof TransactionBuilder>;
const MockedTransaction = Transaction as jest.MockedClass<typeof Transaction>;

describe('TransactionManager', () => {
  let mockHorizonClient: jest.Mocked<Horizon.Server>;
  let transactionManager: TransactionManager;

  beforeEach(() => {
    mockHorizonClient = {
      serverURL: 'https://horizon-testnet.stellar.org',
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
      transactions: jest.fn(),
      ledgers: jest.fn(),
      feeStats: jest.fn(),
    } as unknown as jest.Mocked<Horizon.Server>;

    transactionManager = new TransactionManager({
      horizonClient: mockHorizonClient,
      maxFee: 5000,
      transactionTimeout: 120
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(transactionManager).toBeInstanceOf(TransactionManager);
    });

    it('should use default values when not provided', () => {
      const defaultManager = new TransactionManager({
        horizonClient: mockHorizonClient
      });
      expect(defaultManager).toBeInstanceOf(TransactionManager);
    });
  });

  describe('build', () => {
    it('should delegate to buildTransaction function', async () => {
      const sourceAccountId = Keypair.random().publicKey();
      const params: BuildParams = {
        sourceAccount: sourceAccountId,
        operations: [{
          type: 'Payment',
          destination: 'GDEST456',
          asset: 'native',
          amount: '10'
        }]
      };

      const mockAccount = {
        accountId: () => sourceAccountId,
        sequenceNumber: () => '123456789'
      };
      mockHorizonClient.loadAccount.mockResolvedValue(mockAccount as unknown as Horizon.AccountResponse);

      // Mock TransactionBuilder and Transaction
      const mockTransaction = {
        hash: () => Buffer.from('testhash', 'hex'),
        toXDR: () => 'test-xdr'
      };
      
      const mockBuilder = {
        addMemo: jest.fn().mockReturnThis(),
        build: () => mockTransaction
      };
      
      // @ts-expect-error - Mock implementation doesn't need full TransactionBuilder interface
      MockedTransactionBuilder.mockImplementation(() => mockBuilder);

      const result = await transactionManager.build(params);
      
      expect(mockHorizonClient.loadAccount).toHaveBeenCalledWith(sourceAccountId);
      expect(result).toBeDefined();
    });
  });

  describe('sign', () => {
    it('should delegate to signTransaction function', () => {
      const mockTransaction = {
        sign: jest.fn()
      } as unknown as Transaction;
      const mockKeypair = Keypair.random();

      const result = transactionManager.sign(mockTransaction, [mockKeypair]);
      
      expect(mockTransaction.sign).toHaveBeenCalledWith(mockKeypair);
      expect(result).toBe(mockTransaction);
    });
  });

  describe('submit', () => {
    it('should delegate to submitTransaction function', async () => {
      const mockTransaction = {
        hash: () => Buffer.from('testhash', 'hex')
      } as unknown as Transaction;

      const mockResult = {
        successful: true,
        hash: 'test-hash',
        ledger: 12345,
        result_xdr: 'test-xdr'
      };
      mockHorizonClient.submitTransaction.mockResolvedValue(mockResult as unknown as Horizon.HorizonApi.SubmitTransactionResponse);

      const result = await transactionManager.submit(mockTransaction);
      
      expect(mockHorizonClient.submitTransaction).toHaveBeenCalledWith(mockTransaction);
      expect(result).toEqual({
        successful: true,
        hash: 'test-hash',
        ledger: 12345,
        resultXdr: 'test-xdr'
      });
    });
  });

  describe('monitor', () => {
    it('should delegate to monitorTransaction function', async () => {
      const hash = 'test-hash';
      
      const mockTransactionCall = {
        call: jest.fn().mockImplementation(() => Promise.resolve({
          hash: 'test-hash',
          ledger_attr: 12345,
          successful: true
        }))
      };
      const mockTransactions = {
        transaction: jest.fn().mockReturnValue(mockTransactionCall)
      };
      // @ts-expect-error - Mock implementation doesn't need full interface
      mockHorizonClient.transactions.mockReturnValue(mockTransactions);

      const mockLedgerCall = {
        call: jest.fn().mockImplementation(() => Promise.resolve({
          records: [{ sequence: 12347 }]
        }))
      };
      const mockLedgers = {
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue(mockLedgerCall)
      };
      // @ts-expect-error - Mock implementation doesn't need full interface
      mockHorizonClient.ledgers.mockReturnValue(mockLedgers);

      const result = await transactionManager.monitor(hash);
      
      expect(result).toEqual({
        confirmed: true,
        confirmations: 3,
        ledger: 12345,
        hash: 'test-hash',
        successful: true
      });
    });
  });

  describe('estimateFee', () => {
    it('should delegate to estimateTransactionFee function', async () => {
      const params: BuildParams = {
        sourceAccount: 'GTEST123',
        operations: [{
          type: 'Payment',
          destination: 'GDEST456',
          asset: 'native',
          amount: '10'
        }]
      };

      mockHorizonClient.feeStats.mockResolvedValue({
        last_ledger_base_fee: '100'
      } as unknown as Horizon.HorizonApi.FeeStatsResponse);

      const result = await transactionManager.estimateFee(params);
      
      expect(mockHorizonClient.feeStats).toHaveBeenCalled();
      expect(result).toBe('100');
    });
  });

  describe('toXDR', () => {
    it('should delegate to transactionToXDR function', () => {
      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue('test-xdr')
      } as unknown as Transaction;

      const result = transactionManager.toXDR(mockTransaction);
      
      expect(mockTransaction.toXDR).toHaveBeenCalled();
      expect(result).toBe('test-xdr');
    });
  });

  describe('fromXDR', () => {
    it('should delegate to transactionFromXDR function', () => {
      const xdr = 'test-xdr';
      const networkPassphrase = Networks.TESTNET;
      
      const mockTransaction = { hash: 'test' };
      // @ts-expect-error - Mock implementation doesn't need full Transaction interface
      MockedTransaction.mockReturnValue(mockTransaction);

      const result = transactionManager.fromXDR(xdr, networkPassphrase);
      
      expect(MockedTransaction).toHaveBeenCalledWith(xdr, networkPassphrase);
      expect(result).toBe(mockTransaction);
    });
  });
});

describe('Standalone Functions', () => {
  let mockHorizonClient: jest.Mocked<Horizon.Server>;

  beforeEach(() => {
    mockHorizonClient = {
      serverURL: 'https://horizon-testnet.stellar.org',
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
      transactions: jest.fn(),
      ledgers: jest.fn(),
      feeStats: jest.fn(),
    } as unknown as jest.Mocked<Horizon.Server>;
  });

  describe('buildTransaction', () => {
    it('should build a transaction with provided parameters', async () => {
      const sourceAccountId = Keypair.random().publicKey();
      const params: BuildParams = {
        sourceAccount: sourceAccountId,
        operations: [{
          type: 'Payment',
          destination: 'GDEST456',
          asset: 'native',
          amount: '10'
        }],
        memo: 'test memo'
      };

      const mockAccount = {
        accountId: () => sourceAccountId,
        sequenceNumber: () => '123456789'
      };
      mockHorizonClient.loadAccount.mockResolvedValue(mockAccount as unknown as Horizon.AccountResponse);

      const mockTransaction = {
        hash: () => Buffer.from('testhash', 'hex')
      };
      
      const mockBuilder = {
        addMemo: jest.fn().mockReturnThis(),
        build: () => mockTransaction
      };
      
      // @ts-expect-error - Mock implementation doesn't need full TransactionBuilder interface
      MockedTransactionBuilder.mockImplementation(() => mockBuilder);

      const result = await buildTransaction(params, mockHorizonClient);
      
      expect(mockHorizonClient.loadAccount).toHaveBeenCalledWith(sourceAccountId);
      expect(result).toBe(mockTransaction);
    });
  });

  describe('signTransaction', () => {
    it('should sign transaction with provided keypairs', () => {
      const mockTransaction = {
        sign: jest.fn()
      } as unknown as Transaction;
      const keypair1 = Keypair.random();
      const keypair2 = Keypair.random();

      const result = signTransaction(mockTransaction, [keypair1, keypair2]);
      
      expect(mockTransaction.sign).toHaveBeenCalledTimes(2);
      expect(mockTransaction.sign).toHaveBeenCalledWith(keypair1);
      expect(mockTransaction.sign).toHaveBeenCalledWith(keypair2);
      expect(result).toBe(mockTransaction);
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction and return result', async () => {
      const mockTransaction = {
        hash: () => Buffer.from('testhash', 'hex')
      } as unknown as Transaction;

      const mockResult = {
        successful: true,
        hash: 'test-hash',
        ledger: 12345,
        result_xdr: 'test-xdr'
      };
      mockHorizonClient.submitTransaction.mockResolvedValue(mockResult as unknown as Horizon.HorizonApi.SubmitTransactionResponse);

      const result = await submitTransaction(mockTransaction, mockHorizonClient);
      
      expect(result).toEqual({
        successful: true,
        hash: 'test-hash',
        ledger: 12345,
        resultXdr: 'test-xdr'
      });
    });

    it('should throw error on submission failure', async () => {
      const mockTransaction = {
        hash: () => Buffer.from('testhash', 'hex')
      } as unknown as Transaction;

      const error = new Error('Submission failed');
      mockHorizonClient.submitTransaction.mockRejectedValue(error);

      await expect(submitTransaction(mockTransaction, mockHorizonClient))
        .rejects.toThrow('Submission failed');
    });
  });

  describe('estimateTransactionFee', () => {
    it('should return estimated fee based on fee stats', async () => {
      const params: BuildParams = {
        sourceAccount: 'GTEST123',
        operations: [
          { type: 'Payment', destination: 'GDEST456', asset: 'native', amount: '10' },
          { type: 'Payment', destination: 'GDEST789', asset: 'native', amount: '20' }
        ]
      };

      mockHorizonClient.feeStats.mockResolvedValue({
        last_ledger_base_fee: '100'
      } as unknown as Horizon.HorizonApi.FeeStatsResponse);

      const result = await estimateTransactionFee(params, mockHorizonClient);
      
      expect(result).toBe('200'); // 100 * 2 operations
    });

    it('should return default fee on fee stats failure', async () => {
      const params: BuildParams = {
        sourceAccount: 'GTEST123',
        operations: [
          { type: 'Payment', destination: 'GDEST456', asset: 'native', amount: '10' }
        ]
      };

      mockHorizonClient.feeStats.mockRejectedValue(new Error('Fee stats failed'));

      const result = await estimateTransactionFee(params, mockHorizonClient);
      
      expect(result).toBe(DEFAULT_MAX_FEE.toString());
    });
  });

  describe('transactionToXDR', () => {
    it('should convert transaction to XDR', () => {
      const mockTransaction = {
        toXDR: jest.fn().mockReturnValue('test-xdr')
      } as unknown as Transaction;

      const result = transactionToXDR(mockTransaction);
      
      expect(mockTransaction.toXDR).toHaveBeenCalled();
      expect(result).toBe('test-xdr');
    });
  });

  describe('transactionFromXDR', () => {
    it('should create transaction from XDR', () => {
      const xdr = 'test-xdr';
      const networkPassphrase = Networks.TESTNET;
      
      const mockTransaction = { hash: 'test' };
      // @ts-expect-error - Mock implementation doesn't need full Transaction interface
      MockedTransaction.mockReturnValue(mockTransaction);

      const result = transactionFromXDR(xdr, networkPassphrase);
      
      expect(MockedTransaction).toHaveBeenCalledWith(xdr, networkPassphrase);
      expect(result).toBe(mockTransaction);
    });
  });
});