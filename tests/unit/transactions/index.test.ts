import { 
  buildMultisigTransaction, 
  fetchTransactionOnce,
  TransactionManager,
  buildTransaction,
  signTransaction,
  submitTransaction,
  monitorTransaction,
  estimateTransactionFee,
  transactionToXDR,
  transactionFromXDR
} from '../../../src/transactions';
import { HorizonSubmitError } from '../../../src/utils/errors';

describe('transactions module', () => {
  describe('placeholder functions', () => {
    it('exports callable placeholder function', () => {
      expect(buildMultisigTransaction()).toBeUndefined();
    });
  });

  describe('exports', () => {
    it('exports TransactionManager class', () => {
      expect(TransactionManager).toBeDefined();
      expect(typeof TransactionManager).toBe('function');
    });

    it('exports standalone functions', () => {
      expect(typeof buildTransaction).toBe('function');
      expect(typeof signTransaction).toBe('function');
      expect(typeof submitTransaction).toBe('function');
      expect(typeof monitorTransaction).toBe('function');
      expect(typeof estimateTransactionFee).toBe('function');
      expect(typeof transactionToXDR).toBe('function');
      expect(typeof transactionFromXDR).toBe('function');
    });
  });
});

describe('fetchTransactionOnce', () => {
  const hash = 'abc123';
  const baseUrl = 'https://horizon-testnet.stellar.org/transactions/';
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns found: true for successful tx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ successful: true, ledger: 123, created_at: '2024-01-01T00:00:00Z' }),
    });
    const result = await fetchTransactionOnce(hash);
    expect(result).toEqual({ found: true, successful: true, ledger: 123, createdAt: '2024-01-01T00:00:00Z' });
    expect(global.fetch).toHaveBeenCalledWith(baseUrl + hash);
  });

  it('returns found: true for failed tx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ successful: false, ledger: 456, created_at: '2024-01-02T00:00:00Z' }),
    });
    const result = await fetchTransactionOnce(hash);
    expect(result).toEqual({ found: true, successful: false, ledger: 456, createdAt: '2024-01-02T00:00:00Z' });
  });

  it('returns found: false for 404', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 404, ok: false });
    const result = await fetchTransactionOnce(hash);
    expect(result).toEqual({ found: false });
  });

  it('throws HorizonSubmitError for network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(fetchTransactionOnce(hash)).rejects.toThrow(HorizonSubmitError);
  });

  it('throws HorizonSubmitError for non-404 HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 500, ok: false });
    await expect(fetchTransactionOnce(hash)).rejects.toThrow(HorizonSubmitError);
  });
});

