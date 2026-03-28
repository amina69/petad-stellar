import { EscrowStatus } from '../../../src/types/escrow';
import { getEscrowStatus } from '../../../src/escrow';

const mockLoadAccount = jest.fn();

jest.mock('@stellar/stellar-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    loadAccount: mockLoadAccount,
  })),
}));

describe('getEscrowStatus', () => {
  beforeEach(() => {
    mockLoadAccount.mockReset();
  });

  function createAccountResponse(
    balance: string,
    signers: Array<{ publicKey: string; weight: number }>,
    thresholds = { low: 1, medium: 2, high: 2 },
  ) {
    return {
      balances: [{ asset_type: 'native', balance }],
      signers,
      thresholds,
    };
  }

  it('returns NOT_FOUND when the account does not exist', async () => {
    mockLoadAccount.mockRejectedValue({ response: { status: 404 } });

    const status = await getEscrowStatus('GFAKE', '10');

    expect(status).toBe(EscrowStatus.NOT_FOUND);
  });

  it('returns CREATED when account exists but has not hit deposit threshold and has no standard escrow signer configuration', async () => {
    mockLoadAccount.mockResolvedValue(
      createAccountResponse('1.5', [{ publicKey: 'G1', weight: 1 }], { low: 1, medium: 1, high: 1 }),
    );

    const status = await getEscrowStatus('GCREATED', '5');

    expect(status).toBe(EscrowStatus.CREATED);
  });

  it('returns FUNDED when balance is above threshold and escrow has a standard 3-signer config', async () => {
    mockLoadAccount.mockResolvedValue(
      createAccountResponse('10', [
        { publicKey: 'G1', weight: 1 },
        { publicKey: 'G2', weight: 1 },
        { publicKey: 'G3', weight: 1 },
      ]),
    );

    const status = await getEscrowStatus('GFUNDED', '5');

    expect(status).toBe(EscrowStatus.FUNDED);
  });

  it('returns DISPUTED when only one signer controls the account with weight >= 2', async () => {
    mockLoadAccount.mockResolvedValue(
      createAccountResponse('15', [
        { publicKey: 'GPLATFORM', weight: 2 },
        { publicKey: 'G1', weight: 1 },
        { publicKey: 'G2', weight: 1 },
      ]),
    );

    const status = await getEscrowStatus('GDISPUTED', '10');

    expect(status).toBe(EscrowStatus.DISPUTED);
  });

  it('returns SETTLING when the account has a standard escrow signer config and is below deposit threshold', async () => {
    mockLoadAccount.mockResolvedValue(
      createAccountResponse('3', [
        { publicKey: 'G1', weight: 1 },
        { publicKey: 'G2', weight: 1 },
        { publicKey: 'G3', weight: 1 },
      ]),
    );

    const status = await getEscrowStatus('GSETTLING', '5');

    expect(status).toBe(EscrowStatus.SETTLING);
  });

  it('returns SETTLED when the account balance is at or below the minimum reserve', async () => {
    mockLoadAccount.mockResolvedValue(
      createAccountResponse('1.0', [
        { publicKey: 'G1', weight: 1 },
        { publicKey: 'G2', weight: 1 },
        { publicKey: 'G3', weight: 1 },
      ]),
    );

    const status = await getEscrowStatus('GSETTLED', '5');

    expect(status).toBe(EscrowStatus.SETTLED);
  });
});
