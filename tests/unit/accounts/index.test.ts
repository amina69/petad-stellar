import { verifyAccount } from '../../../src/accounts';
import { HorizonSubmitError, ValidationError } from '../../../src/utils/errors';

const VALID_PUBLIC_KEY = 'GADOPTER111111111111111111111111111111111111111111111111';
const MOCK_HORIZON_URL = 'http://mock-horizon.test';

describe('verifyAccount', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns full account details when the account exists', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: VALID_PUBLIC_KEY,
        sequence: '123456789',
        balances: [
          { asset_type: 'credit_alphanum4', balance: '25.0000000' },
          { asset_type: 'native', balance: '100.5000000' },
        ],
        signers: [
          { key: VALID_PUBLIC_KEY, weight: 1 },
          { key: 'GSIGNER11111111111111111111111111111111111111111111111111', weight: 2 },
        ],
        thresholds: {
          low_threshold: 1,
          med_threshold: 2,
          high_threshold: 3,
        },
      }),
    }) as typeof fetch;

    await expect(verifyAccount(VALID_PUBLIC_KEY, MOCK_HORIZON_URL)).resolves.toEqual({
      accountId: VALID_PUBLIC_KEY,
      balance: '100.5000000',
      signers: [
        { publicKey: VALID_PUBLIC_KEY, weight: 1 },
        { publicKey: 'GSIGNER11111111111111111111111111111111111111111111111111', weight: 2 },
      ],
      thresholds: {
        low: 1,
        medium: 2,
        high: 3,
      },
      sequenceNumber: '123456789',
      exists: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(`${MOCK_HORIZON_URL}/accounts/${VALID_PUBLIC_KEY}`);
  });

  it('returns exists false for a non-existent account', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as typeof fetch;

    await expect(verifyAccount(VALID_PUBLIC_KEY, MOCK_HORIZON_URL)).resolves.toEqual({
      accountId: VALID_PUBLIC_KEY,
      balance: '0',
      signers: [],
      thresholds: {
        low: 0,
        medium: 0,
        high: 0,
      },
      sequenceNumber: '0',
      exists: false,
    });
  });

  it('throws ValidationError for an invalid key', async () => {
    await expect(verifyAccount('BAD_KEY', MOCK_HORIZON_URL)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws HorizonSubmitError on network failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('socket hang up')) as typeof fetch;

    await expect(verifyAccount(VALID_PUBLIC_KEY, MOCK_HORIZON_URL)).rejects.toBeInstanceOf(HorizonSubmitError);
  });
});
