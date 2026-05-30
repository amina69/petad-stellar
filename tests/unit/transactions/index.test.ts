import axios from 'axios';
import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TimeoutInfinite,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import {
  buildCreateAccountOp,
  buildMultisigTransaction,
  submitTransaction,
  transactionFromXDR,
  transactionToXDR,
} from '../../../src/transactions';
import {
  HorizonSubmitError,
  InsufficientBalanceError,
  TransactionTimeoutError,
} from '../../../src/utils/errors';

jest.mock('axios', () => ({
  __esModule: true,
  ...jest.requireActual('axios'),
  default: Object.assign(jest.requireActual('axios').default, {
    post: jest.fn(),
  }),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const VALID_DESTINATION = Keypair.random().publicKey();

function buildTestTransaction() {
  const source = new Account(Keypair.random().publicKey(), '1');
  return new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: 'note', value: 'hello' }))
    .setTimeout(TimeoutInfinite)
    .build();
}

function makeHorizonError(
  status: number,
  resultCodes?: string | { transaction?: string; operations?: string[] },
) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: {
        extras: {
          result_codes: resultCodes,
        },
      },
    },
  };
}

describe('transactions module', () => {
  afterEach(() => {
    mockedAxios.post.mockReset();
  });

  it('keeps multisig placeholder callable', () => {
    expect(buildMultisigTransaction()).toBeUndefined();
  });

  it('builds a valid create-account operation', () => {
    const operation = buildCreateAccountOp({
      destination: VALID_DESTINATION,
      startingBalance: '1.5',
    });

    expect(operation).toEqual(
      Operation.createAccount({
        destination: VALID_DESTINATION,
        startingBalance: '1.5',
      }),
    );
  });

  it('rejects a starting balance below the minimum reserve', () => {
    expect(() => buildCreateAccountOp({
      destination: VALID_DESTINATION,
      startingBalance: '0.5',
    })).toThrow('minimum reserve');
  });

  it('serialises and deserialises a transaction', () => {
    const tx = buildTestTransaction();
    const xdr = transactionToXDR(tx);
    const roundTripped = transactionFromXDR(xdr);

    expect(roundTripped.toXDR()).toBe(xdr);
    expect(roundTripped.operations).toEqual(tx.operations);
    expect(roundTripped.source).toBe(tx.source);
  });

  it('rejects invalid XDR input', () => {
    expect(() => transactionFromXDR('')).toThrow('Invalid XDR envelope');
    expect(() => transactionFromXDR('not xdr')).toThrow('Invalid XDR envelope');
  });

  it('submits a signed transaction', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockResolvedValue({
      data: {
        successful: true,
        hash: 'hash123',
        ledger: 42,
        result_xdr: 'result-xdr',
      },
    });

    await expect(submitTransaction(tx)).resolves.toEqual({
      successful: true,
      hash: 'hash123',
      ledger: 42,
      resultXdr: 'result-xdr',
    });
  });

  it('maps tx_bad_seq to HorizonSubmitError', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockRejectedValue(makeHorizonError(400, 'tx_bad_seq'));

    await expect(submitTransaction(tx)).rejects.toBeInstanceOf(HorizonSubmitError);
    await expect(submitTransaction(tx)).rejects.toMatchObject({
      code: 'HORIZON_SUBMIT_ERROR',
      retryable: true,
    });
  });

  it('maps tx_bad_auth to HorizonSubmitError', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockRejectedValue(makeHorizonError(400, 'tx_bad_auth'));

    await expect(submitTransaction(tx)).rejects.toMatchObject({
      code: 'HORIZON_SUBMIT_ERROR',
      retryable: false,
    });
  });

  it('maps op_underfunded to InsufficientBalanceError', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockRejectedValue(
      makeHorizonError(400, { transaction: 'tx_failed', operations: ['op_underfunded'] }),
    );

    await expect(submitTransaction(tx)).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('maps 504 to TransactionTimeoutError', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockRejectedValue(makeHorizonError(504, 'timeout'));

    await expect(submitTransaction(tx)).rejects.toBeInstanceOf(TransactionTimeoutError);
    await expect(submitTransaction(tx)).rejects.toMatchObject({ retryable: true });
  });

  it('maps unknown errors to HorizonSubmitError', async () => {
    const tx = buildTestTransaction();
    mockedAxios.post.mockRejectedValue(makeHorizonError(400, 'tx_no_account'));

    await expect(submitTransaction(tx)).rejects.toMatchObject({
      code: 'HORIZON_SUBMIT_ERROR',
    });
  });
});
