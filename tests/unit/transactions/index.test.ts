import {
  buildMultisigTransaction,
  monitorTransaction,
} from '../../../src/transactions';
import { MonitorTimeoutError } from '../../../src/utils/errors';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function createResponse(status: number, payload: unknown): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe('transactions module', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();

    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof global.fetch }).fetch;
    }

    jest.restoreAllMocks();
  });

  it('exports callable placeholder function', () => {
    expect(buildMultisigTransaction()).toBeUndefined();
  });

  it('returns confirmed status when transaction is found on the 3rd attempt', async () => {
    const fetchMock = jest
      .fn<Promise<MockFetchResponse>, [string]>()
      .mockResolvedValueOnce(createResponse(404, {}))
      .mockResolvedValueOnce(createResponse(404, {}))
      .mockResolvedValueOnce(
        createResponse(200, {
          hash: 'tx-success-3rd-attempt',
          ledger: 100,
          currentLedger: 107,
          successful: true,
        }),
      );

    global.fetch = fetchMock as unknown as typeof global.fetch;

    const status = await monitorTransaction('tx-success-3rd-attempt', {
      maxAttempts: 5,
      intervalMs: 1,
    });

    expect(status).toEqual({
      confirmed: true,
      confirmations: 7,
      ledger: 100,
      hash: 'tx-success-3rd-attempt',
      successful: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns unsuccessful status when Horizon reports failed transaction', async () => {
    const fetchMock = jest.fn<Promise<MockFetchResponse>, [string]>().mockResolvedValue(
      createResponse(200, {
        hash: 'tx-failed',
        ledger: 220,
        currentLedger: 225,
        successful: false,
      }),
    );

    global.fetch = fetchMock as unknown as typeof global.fetch;

    const status = await monitorTransaction('tx-failed', {
      maxAttempts: 3,
      intervalMs: 1,
    });

    expect(status).toEqual({
      confirmed: false,
      confirmations: 5,
      ledger: 220,
      hash: 'tx-failed',
      successful: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws MonitorTimeoutError when max attempts are exceeded', async () => {
    jest.useFakeTimers();

    const fetchMock = jest
      .fn<Promise<MockFetchResponse>, [string]>()
      .mockResolvedValue(createResponse(404, {}));

    global.fetch = fetchMock as unknown as typeof global.fetch;

    const monitorPromise = monitorTransaction('tx-timeout', {
      maxAttempts: 3,
      intervalMs: 100,
    });
    const timeoutExpectation = expect(monitorPromise).rejects.toEqual(
      expect.objectContaining({
        name: MonitorTimeoutError.name,
        txHash: 'tx-timeout',
        attempts: 3,
      }),
    );

    await jest.advanceTimersByTimeAsync(250);

    await timeoutExpectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

