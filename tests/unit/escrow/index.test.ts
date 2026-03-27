import {
  getEscrowBalance,
  createEscrowAccount,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { EscrowNotFoundError, ValidationError } from '../../../src/utils/errors';
import { BalanceInfo } from '../../../src/types/network';

const MOCK_HORIZON_URL = 'https://horizon-testnet.stellar.org';

// Mock fetch globally
global.fetch = jest.fn();

describe('getEscrowBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validation', () => {
    it('throws ValidationError for invalid public key', async () => {
      await expect(getEscrowBalance('invalid-key', MOCK_HORIZON_URL)).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws ValidationError for empty string', async () => {
      await expect(getEscrowBalance('', MOCK_HORIZON_URL)).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws ValidationError for incorrect key format', async () => {
      // Key starting with wrong letter
      await expect(
        getEscrowBalance(
          'SINVALID1234567890123456789012345678901234567890123456789',
          MOCK_HORIZON_URL,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('happy path - funded account', () => {
    it('returns BalanceInfo for account with native balance', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';
      const balance = '1234.5000000';
      const lastModifiedLedger = 42824530;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: validAccountId,
          account_id: validAccountId,
          balances: [
            {
              balance,
              asset_type: 'native',
            },
          ],
          last_modified_ledger: lastModifiedLedger,
        }),
      });

      const result: BalanceInfo = await getEscrowBalance(
        validAccountId,
        MOCK_HORIZON_URL,
      );

      expect(result).toEqual({
        accountId: validAccountId,
        balance,
        lastModifiedLedger,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `${MOCK_HORIZON_URL}/accounts/${validAccountId}`,
      );
    });
  });

  describe('happy path - zero balance account', () => {
    it('returns BalanceInfo with zero balance when native balance is absent', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';
      const lastModifiedLedger = 42824530;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: validAccountId,
          account_id: validAccountId,
          balances: [
            {
              balance: '100.0000000',
              asset_code: 'USD',
              asset_issuer: 'GBUQWP3BOUZX34ULNQG23RQ6F4BFXEUVSMEA37XPR5G4WSLLOON3XHU',
              asset_type: 'credit_alphanum4',
            },
          ],
          last_modified_ledger: lastModifiedLedger,
        }),
      });

      const result: BalanceInfo = await getEscrowBalance(
        validAccountId,
        MOCK_HORIZON_URL,
      );

      expect(result).toEqual({
        accountId: validAccountId,
        balance: '0',
        lastModifiedLedger,
      });
    });

    it('returns BalanceInfo with zero balance when balances array is empty', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';
      const lastModifiedLedger = 42824530;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: validAccountId,
          account_id: validAccountId,
          balances: [],
          last_modified_ledger: lastModifiedLedger,
        }),
      });

      const result: BalanceInfo = await getEscrowBalance(
        validAccountId,
        MOCK_HORIZON_URL,
      );

      expect(result).toEqual({
        accountId: validAccountId,
        balance: '0',
        lastModifiedLedger,
      });
    });
  });

  describe('error handling', () => {
    it('throws EscrowNotFoundError for 404 response', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        getEscrowBalance(validAccountId, MOCK_HORIZON_URL),
      ).rejects.toThrow(EscrowNotFoundError);
    });

    it('throws error for non-404 HTTP errors', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        getEscrowBalance(validAccountId, MOCK_HORIZON_URL),
      ).rejects.toThrow('Horizon error: Internal Server Error');
    });

    it('throws error for network failure', async () => {
      const validAccountId = 'GBRPYHIL2CI3WHZSRXUBXSMEGBMNQPU7HY3ZMTSPYDZPA46PHYUQJZQ2';

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network unreachable'),
      );

      await expect(
        getEscrowBalance(validAccountId, MOCK_HORIZON_URL),
      ).rejects.toThrow('Failed to fetch escrow balance: Network unreachable');
    });
  });

  describe('escrow module placeholders', () => {
    it('exports callable placeholder functions', () => {
      expect(createEscrowAccount()).toBeUndefined();
      expect(lockCustodyFunds()).toBeUndefined();
      expect(anchorTrustHash()).toBeUndefined();
      expect(verifyEventHash()).toBeUndefined();
    });
  });
});

