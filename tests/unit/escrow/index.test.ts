import { Horizon, NotFoundError } from '@stellar/stellar-sdk';

import {
  releaseFunds,
  validateReleaseFundsParams,
  createEscrowAccount,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';
import { asPercentage } from '../../../src/types/escrow';
import {
  EscrowNotFoundError,
  InsufficientBalanceError,
  ValidationError,
} from '../../../src/utils/errors';

const VALID_ESCROW_ACCOUNT_ID =
  'GADOPTER111111111111111111111111111111111111111111111111';
const VALID_RECIPIENT_A =
  'GOWNER11111111111111111111111111111111111111111111111111';
const VALID_RECIPIENT_B =
  'GOWNER22222222222222222222222222222222222222222222222222';

function createMockAccount(balance: string) {
  return {
    id: 'account-id',
    paging_token: '1',
    account_id: VALID_ESCROW_ACCOUNT_ID,
    sequence: '123',
    subentry_count: 0,
    last_modified_ledger: 1,
    last_modified_time: '2026-03-27T00:00:00Z',
    thresholds: { low_threshold: 1, med_threshold: 1, high_threshold: 1 },
    flags: {
      auth_required: false,
      auth_revocable: false,
      auth_immutable: false,
      auth_clawback_enabled: false,
    },
    balances: [{ asset_type: 'native', balance }],
    signers: [],
    data: {},
    _links: {
      self: { href: 'https://horizon-testnet.stellar.org/accounts/mock' },
      transactions: { href: 'https://horizon-testnet.stellar.org/accounts/mock/transactions' },
      operations: { href: 'https://horizon-testnet.stellar.org/accounts/mock/operations' },
      payments: { href: 'https://horizon-testnet.stellar.org/accounts/mock/payments' },
      effects: { href: 'https://horizon-testnet.stellar.org/accounts/mock/effects' },
      offers: { href: 'https://horizon-testnet.stellar.org/accounts/mock/offers' },
      trades: { href: 'https://horizon-testnet.stellar.org/accounts/mock/trades' },
      data: { href: 'https://horizon-testnet.stellar.org/accounts/mock/data/{key}', templated: true },
    },
    num_sponsoring: 0,
    num_sponsored: 0,
  } as unknown as Horizon.AccountResponse;
}

const VALID_DISTRIBUTION = [
  { recipient: VALID_RECIPIENT_A, percentage: asPercentage(60) },
  { recipient: VALID_RECIPIENT_B, percentage: asPercentage(40) },
];

describe('escrow module placeholders', () => {
  it('exports callable placeholder functions', () => {
    expect(createEscrowAccount()).toBeUndefined();
    expect(lockCustodyFunds()).toBeUndefined();
    expect(anchorTrustHash()).toBeUndefined();
    expect(verifyEventHash()).toBeUndefined();
  });
});

describe('releaseFunds validation', () => {
  it('throws ValidationError for an invalid escrow public key', async () => {
    const loadAccount = jest.fn();

    await expect(
      validateReleaseFundsParams(
        {
          escrowAccountId: 'NOT_A_PUBLIC_KEY',
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(loadAccount).not.toHaveBeenCalled();
  });

  it('throws ValidationError for an invalid distribution payload', async () => {
    const loadAccount = jest.fn();

    await expect(
      validateReleaseFundsParams(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [],
        },
        { loadAccount },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(loadAccount).not.toHaveBeenCalled();
  });

  it('throws EscrowNotFoundError when Horizon cannot find the escrow account', async () => {
    const loadAccount = jest.fn().mockRejectedValue(
      new NotFoundError('Resource Missing', { status: 404 }),
    );

    await expect(
      validateReleaseFundsParams(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).rejects.toBeInstanceOf(EscrowNotFoundError);
  });

  it('throws InsufficientBalanceError when the escrow has zero native balance', async () => {
    const loadAccount = jest.fn().mockResolvedValue(createMockAccount('0'));

    await expect(
      releaseFunds(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('throws InsufficientBalanceError when the account has no native balance entry', async () => {
    const accountWithoutNative = {
      ...createMockAccount('25.5'),
      balances: [],
    } as unknown as Horizon.AccountResponse;
    const loadAccount = jest.fn().mockResolvedValue(accountWithoutNative);

    await expect(
      releaseFunds(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).rejects.toBeInstanceOf(InsufficientBalanceError);
  });

  it('rethrows non-not-found Horizon errors without remapping them', async () => {
    const networkError = new Error('horizon unavailable');
    const loadAccount = jest.fn().mockRejectedValue(networkError);

    await expect(
      releaseFunds(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).rejects.toBe(networkError);
  });

  it('returns the validated Horizon account record on success', async () => {
    const account = createMockAccount('25.5');
    const loadAccount = jest.fn().mockResolvedValue(account);

    await expect(
      releaseFunds(
        {
          escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
          distribution: [...VALID_DISTRIBUTION],
        },
        { loadAccount },
      ),
    ).resolves.toBe(account);
  });

  it('is idempotent for repeated calls with the same params and account state', async () => {
    const account = createMockAccount('25.5');
    const loadAccount = jest.fn().mockResolvedValue(account);
    const params = {
      escrowAccountId: VALID_ESCROW_ACCOUNT_ID,
      distribution: [...VALID_DISTRIBUTION],
    };

    await expect(releaseFunds(params, { loadAccount })).resolves.toBe(account);
    await expect(releaseFunds(params, { loadAccount })).resolves.toBe(account);

    expect(loadAccount).toHaveBeenCalledTimes(2);
    expect(loadAccount).toHaveBeenNthCalledWith(1, VALID_ESCROW_ACCOUNT_ID);
    expect(loadAccount).toHaveBeenNthCalledWith(2, VALID_ESCROW_ACCOUNT_ID);
  });
});

