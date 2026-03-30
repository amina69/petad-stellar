import { fetchSequenceNumber } from '../../../src/transactions';
import { Server } from '@stellar/stellar-sdk';
import { AccountNotFoundError } from '../../../src/utils/errors';

jest.mock('@stellar/stellar-sdk');

describe('fetchSequenceNumber', () => {
  const accountId = 'GABC123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sequence from horizon', async () => {
    const mockCall = jest.fn().mockResolvedValue({ sequence: '42' });
    // @ts-ignore
    Server.mockImplementation(() => ({ accounts: () => ({ accountId: () => ({ call: mockCall }) }) }));

    const seq = await fetchSequenceNumber(accountId);
    expect(seq).toBe('42');
    expect(mockCall).toHaveBeenCalled();
  });

  it('caches result for 5s', async () => {
    const mockCall = jest.fn().mockResolvedValue({ sequence: '100' });
    // @ts-ignore
    Server.mockImplementation(() => ({ accounts: () => ({ accountId: () => ({ call: mockCall }) }) }));

    const a = await fetchSequenceNumber(accountId);
    const b = await fetchSequenceNumber(accountId);
    expect(a).toBe('100');
    expect(b).toBe('100');
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('throws AccountNotFoundError on 404', async () => {
    const err: any = new Error('not found');
    err.response = { status: 404 };
    const mockCall = jest.fn().mockRejectedValue(err);
    // @ts-ignore
    Server.mockImplementation(() => ({ accounts: () => ({ accountId: () => ({ call: mockCall }) }) }));

    await expect(fetchSequenceNumber(accountId)).rejects.toBeInstanceOf(AccountNotFoundError);
  });
});
