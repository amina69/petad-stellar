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

describe('buildSetOptionsOp', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds setOptions operation for adding a signer', () => {
    const signerPublicKey = Keypair.random().publicKey();
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    const operations = buildSetOptionsOp({
      signers: [{ publicKey: signerPublicKey, weight: 1 }],
    });

    expect(operations).toHaveLength(1);
    expect(setOptionsSpy).toHaveBeenCalledWith({
      signer: { ed25519PublicKey: signerPublicKey, weight: 1 },
    });
  });

  it('builds setOptions operation for removing a signer with weight 0', () => {
    const signerPublicKey = Keypair.random().publicKey();
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    const operations = buildSetOptionsOp({
      signers: [{ publicKey: signerPublicKey, weight: 0 }],
    });

    expect(operations).toHaveLength(1);
    expect(setOptionsSpy).toHaveBeenCalledWith({
      signer: { ed25519PublicKey: signerPublicKey, weight: 0 },
    });
  });

  it('builds setOptions operation for thresholds', () => {
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    const operations = buildSetOptionsOp({
      thresholds: { low: 1, medium: 2, high: 3 },
    });

    expect(operations).toHaveLength(1);
    expect(setOptionsSpy).toHaveBeenCalledWith({
      lowThreshold: 1,
      medThreshold: 2,
      highThreshold: 3,
    });
  });

  it('builds mixed setOptions operations for signers and thresholds', () => {
    const signerPublicKey = Keypair.random().publicKey();
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    const operations = buildSetOptionsOp({
      signers: [{ publicKey: signerPublicKey, weight: 2 }],
      thresholds: { low: 1, medium: 2, high: 2 },
      masterWeight: 0,
    });

    expect(operations).toHaveLength(2);
    expect(setOptionsSpy).toHaveBeenNthCalledWith(1, {
      signer: { ed25519PublicKey: signerPublicKey, weight: 2 },
    });
    expect(setOptionsSpy).toHaveBeenNthCalledWith(2, {
      masterWeight: 0,
      lowThreshold: 1,
      medThreshold: 2,
      highThreshold: 2,
    });
  });

  it('throws ValidationError when a signer public key is invalid', () => {
    const setOptionsSpy = jest.spyOn(Operation, 'setOptions');

    expect(() =>
      buildSetOptionsOp({
        signers: [{ publicKey: 'INVALID_PUBLIC_KEY', weight: 1 }],
      }),
    ).toThrow(ValidationError);

    expect(setOptionsSpy).not.toHaveBeenCalled();
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

