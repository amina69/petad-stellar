import { Account, Keypair, TransactionBuilder, Memo } from '@stellar/stellar-sdk';
import { StellarSDK } from '../../../src/sdk';
import {
  HorizonSubmitError,
  InsufficientBalanceError,
  TransactionTimeoutError,
} from '../../../src/utils/errors';

describe('submitTransaction', () => {
  const sdk = new StellarSDK({
    network: 'testnet',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    masterSecretKey: Keypair.random().secret(),
  });

  const sourceAccount = new Account(
    Keypair.random().publicKey(),
    '1',
  );
  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: sdk.networkPassphrase,
  })
    .addMemo(Memo.text('test'))
    .setTimeout(0)
    .build();

  it('successful submission returns result', async () => {
    const mockResult = {
      hash: 'tx-hash',
      ledger: 1000,
      result_xdr: 'result-xdr',
    };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockResolvedValue(mockResult as any);

    const result = await sdk.submitTransaction(tx);

    expect(result.successful).toBe(true);
    expect(result.hash).toBe(mockResult.hash);
    expect(result.ledger).toBe(mockResult.ledger);
    expect(result.resultXdr).toBe(mockResult.result_xdr);
  });

  it('maps tx_bad_seq to retryable HorizonSubmitError', async () => {
    const error: any = new Error('Bad Sequence');
    error.response = {
      data: {
        extras: {
          result_codes: {
            transaction: 'tx_bad_seq',
          },
        },
      },
    };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockRejectedValue(error);

    await expect(sdk.submitTransaction(tx)).rejects.toThrow(HorizonSubmitError);
    try {
      await sdk.submitTransaction(tx);
    } catch (e: any) {
      expect(e.resultCode).toBe('tx_bad_seq');
      expect(e.retryable).toBe(true);
    }
  });

  it('maps tx_bad_auth to non-retryable HorizonSubmitError', async () => {
    const error: any = new Error('Bad Auth');
    error.response = {
      data: {
        extras: {
          result_codes: {
            transaction: 'tx_bad_auth',
          },
        },
      },
    };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockRejectedValue(error);

    await expect(sdk.submitTransaction(tx)).rejects.toThrow(HorizonSubmitError);
    try {
      await sdk.submitTransaction(tx);
    } catch (e: any) {
      expect(e.resultCode).toBe('tx_bad_auth');
      expect(e.retryable).toBe(false);
    }
  });

  it('maps op_underfunded to InsufficientBalanceError', async () => {
    const error: any = new Error('Underfunded');
    error.response = {
      data: {
        extras: {
          result_codes: {
            transaction: 'tx_failed',
            operations: ['op_underfunded'],
          },
        },
      },
    };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockRejectedValue(error);

    await expect(sdk.submitTransaction(tx)).rejects.toThrow(InsufficientBalanceError);
  });

  it('maps 504 status to TransactionTimeoutError', async () => {
    const error: any = new Error('Timeout');
    error.response = { status: 504 };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockRejectedValue(error);

    await expect(sdk.submitTransaction(tx)).rejects.toThrow(TransactionTimeoutError);
    try {
      await sdk.submitTransaction(tx);
    } catch (e: any) {
      expect(e.retryable).toBe(true);
    }
  });

  it('maps unknown error to non-retryable HorizonSubmitError with code', async () => {
    const error: any = new Error('Unknown');
    error.response = {
      data: {
        extras: {
          result_codes: {
            transaction: 'tx_internal_error',
          },
        },
      },
    };
    jest.spyOn(sdk.horizon, 'submitTransaction').mockRejectedValue(error);

    await expect(sdk.submitTransaction(tx)).rejects.toThrow(HorizonSubmitError);
    try {
      await sdk.submitTransaction(tx);
    } catch (e: any) {
      expect(e.resultCode).toBe('tx_internal_error');
    }
  });
});
