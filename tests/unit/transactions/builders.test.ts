import { 
  Transaction, 
  TransactionBuilder as StellarTransactionBuilder, 
  Networks, 
  Keypair,
  Asset,
  Account
} from '@stellar/stellar-sdk';
import { 
  transactionToXDR, 
  transactionFromXDR, 
  buildCreateAccountOp,
  submitTransaction 
} from '../../../src/transactions';
import { ValidationError, HorizonSubmitError, TransactionTimeoutError } from '../../../src/utils/errors';
import { horizonClient } from '../../../src/sdk';

jest.mock('../../../src/sdk', () => ({
  horizonClient: {
    submitTransaction: jest.fn(),
  },
}));

describe('Transaction Builders & Submission', () => {
  const network = 'testnet';
  const networkPassphrase = Networks.TESTNET;
  const sourceKeypair = Keypair.random();
  const destinationKeypair = Keypair.random();

  describe('transactionToXDR & transactionFromXDR', () => {
    it('should round-trip a transaction', async () => {
      const sourceAccount = new Account(sourceKeypair.publicKey(), '1');
      const tx = new StellarTransactionBuilder(
        sourceAccount,
        { fee: '100', networkPassphrase }
      )
        .addOperation(buildCreateAccountOp({ destination: destinationKeypair.publicKey(), startingBalance: '10' }))
        .setTimeout(30)
        .build();

      const xdr = transactionToXDR(tx);
      expect(typeof xdr).toBe('string');
      expect(xdr.length).toBeGreaterThan(0);

      const decodedTx = transactionFromXDR(xdr);
      expect(decodedTx.toXDR()).toBe(xdr);
    });

    it('should throw ValidationError for invalid XDR', () => {
      expect(() => transactionFromXDR('')).toThrow(ValidationError);
      expect(() => transactionFromXDR('invalid-xdr')).toThrow('Invalid XDR envelope');
    });
  });

  describe('buildCreateAccountOp', () => {
    it('should create a valid operation', () => {
      const op = buildCreateAccountOp({
        destination: destinationKeypair.publicKey(),
        startingBalance: '10',
      });
      expect(op.body().switch().name).toBe('createAccount');
    });

    it('should throw ValidationError for invalid destination', () => {
      expect(() => buildCreateAccountOp({
        destination: 'invalid',
        startingBalance: '10',
      })).toThrow('Invalid destination public key');
    });

    it('should throw ValidationError for low starting balance', () => {
      expect(() => buildCreateAccountOp({
        destination: destinationKeypair.publicKey(),
        startingBalance: '0.1',
      })).toThrow(/Starting balance must be at least/);
    });
  });

  describe('submitTransaction', () => {
    it('should return success result on successful submission', async () => {
      const mockResponse = {
        hash: 'txhash',
        ledger: 123,
        result_xdr: 'resultxdr',
      };
      (horizonClient.submitTransaction as jest.Mock).mockResolvedValue(mockResponse);

      const tx = { hash: () => Buffer.from('hash') } as any;
      const result = await submitTransaction(tx);

      expect(result).toEqual({
        hash: 'txhash',
        ledger: 123,
        successful: true,
        resultXdr: 'resultxdr',
      });
    });

    it('should throw TransactionTimeoutError on 504', async () => {
      const error = {
        response: {
          status: 504,
        },
      };
      (horizonClient.submitTransaction as jest.Mock).mockRejectedValue(error);

      const tx = { hash: () => Buffer.from('txhash') } as any;
      await expect(submitTransaction(tx)).rejects.toThrow(TransactionTimeoutError);
    });

    it('should throw HorizonSubmitError with result codes', async () => {
      const error = {
        response: {
          status: 400,
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_bad_seq',
                operations: [],
              },
            },
          },
        },
      };
      (horizonClient.submitTransaction as jest.Mock).mockRejectedValue(error);

      const tx = { hash: () => Buffer.from('hash') } as any;
      await expect(submitTransaction(tx)).rejects.toThrow(HorizonSubmitError);
    });
  });
});
