/**
 * Unit tests for configureMultisig()
 *
 * Uses Jest (the test runner already configured in the repo).
 * All Horizon network calls are mocked so tests run fully offline.
 */
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { configureMultisig } from '../builder';
import { validateMultisigConfig, ValidationError } from '../validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a fresh random Stellar keypair for test use. */
const makeKeypair = () => Keypair.random();

/** Build a minimal mock Server object. */
function makeMockServer(overrides: Partial<{
  loadAccount: jest.Mock;
  submitTransaction: jest.Mock;
}> = {}) {
  return {
    loadAccount: overrides.loadAccount ?? jest.fn(),
    submitTransaction: overrides.submitTransaction ?? jest.fn(),
  } as any;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const master  = makeKeypair();          // master key (signs tx)
const signer1 = makeKeypair();          // signer 1
const signer2 = makeKeypair();          // signer 2

const validThresholds = { low: 1, medium: 2, high: 3 };

// ---------------------------------------------------------------------------
// 1. Invalid signer public key throws ValidationError
// ---------------------------------------------------------------------------
describe('validateMultisigConfig - invalid signer key', () => {
  it('throws ValidationError when a signer publicKey is not a valid Ed25519 key', () => {
    expect(() =>
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [{ publicKey: 'NOT_A_VALID_KEY', weight: 10 }],
        thresholds: validThresholds,
        masterKey: master.publicKey(),
      })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when masterKey is invalid', () => {
    expect(() =>
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer1.publicKey(), weight: 10 }],
        thresholds: validThresholds,
        masterKey: 'BAD_MASTER_KEY',
      })
    ).toThrow(ValidationError);
  });

  it('error message mentions the invalid key', () => {
    try {
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [{ publicKey: 'INVALID', weight: 10 }],
        thresholds: validThresholds,
        masterKey: master.publicKey(),
      });
      fail('Expected ValidationError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain('INVALID');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Insufficient signer weight throws ValidationError
// ---------------------------------------------------------------------------
describe('validateMultisigConfig - insufficient weight', () => {
  it('throws ValidationError when total weight equals high threshold', () => {
    expect(() =>
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer1.publicKey(), weight: 3 }],
        thresholds: { low: 1, medium: 2, high: 3 },
        masterKey: master.publicKey(),
      })
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when total weight is below high threshold', () => {
    expect(() =>
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [
          { publicKey: signer1.publicKey(), weight: 1 },
          { publicKey: signer2.publicKey(), weight: 1 },
        ],
        thresholds: { low: 1, medium: 2, high: 5 },
        masterKey: master.publicKey(),
      })
    ).toThrow(ValidationError);
  });

  it('does NOT throw when total weight is strictly greater than high threshold', () => {
    expect(() =>
      validateMultisigConfig({
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer1.publicKey(), weight: 10 }],
        thresholds: { low: 1, medium: 2, high: 3 },
        masterKey: master.publicKey(),
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Successful configureMultisig returns { accountId, transactionHash }
// ---------------------------------------------------------------------------
describe('configureMultisig - success path', () => {
  const FAKE_HASH = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

  /** Minimal AccountResponse-like object that TransactionBuilder needs. */
  function makeMockAccount(publicKey: string) {
    return {
      id: publicKey,
      accountId: () => publicKey,
      sequenceNumber: () => '100',
      incrementSequenceNumber: jest.fn(),
      sequence: '100',
    };
  }

  it('returns accountId and transactionHash on success', async () => {
    const mockAccount = makeMockAccount(signer1.publicKey());
    const mockSubmitResult = { hash: FAKE_HASH };

    const mockServer = makeMockServer({
      loadAccount: jest.fn().mockResolvedValue(mockAccount),
      submitTransaction: jest.fn().mockResolvedValue(mockSubmitResult),
    });

    const result = await configureMultisig(
      {
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer2.publicKey(), weight: 10 }],
        thresholds: { low: 1, medium: 2, high: 3 },
        masterKey: master.secret(),
      },
      mockServer,
      Networks.TESTNET
    );

    expect(result).toEqual({
      accountId: signer1.publicKey(),
      transactionHash: FAKE_HASH,
    });
  });

  it('calls server.loadAccount with the correct accountId', async () => {
    const mockAccount = makeMockAccount(signer1.publicKey());
    const mockServer = makeMockServer({
      loadAccount: jest.fn().mockResolvedValue(mockAccount),
      submitTransaction: jest.fn().mockResolvedValue({ hash: FAKE_HASH }),
    });

    await configureMultisig(
      {
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer2.publicKey(), weight: 10 }],
        thresholds: { low: 1, medium: 2, high: 3 },
        masterKey: master.secret(),
      },
      mockServer,
      Networks.TESTNET
    );

    expect(mockServer.loadAccount).toHaveBeenCalledWith(signer1.publicKey());
  });

  it('calls server.submitTransaction once', async () => {
    const mockAccount = makeMockAccount(signer1.publicKey());
    const mockServer = makeMockServer({
      loadAccount: jest.fn().mockResolvedValue(mockAccount),
      submitTransaction: jest.fn().mockResolvedValue({ hash: FAKE_HASH }),
    });

    await configureMultisig(
      {
        accountId: signer1.publicKey(),
        signers: [{ publicKey: signer2.publicKey(), weight: 10 }],
        thresholds: { low: 1, medium: 2, high: 3 },
        masterKey: master.secret(),
      },
      mockServer,
      Networks.TESTNET
    );

    expect(mockServer.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('propagates errors thrown by server.loadAccount', async () => {
    const networkError = new Error('Network unavailable');
    const mockServer = makeMockServer({
      loadAccount: jest.fn().mockRejectedValue(networkError),
      submitTransaction: jest.fn(),
    });

    await expect(
      configureMultisig(
        {
          accountId: signer1.publicKey(),
          signers: [{ publicKey: signer2.publicKey(), weight: 10 }],
          thresholds: { low: 1, medium: 2, high: 3 },
          masterKey: master.secret(),
        },
        mockServer,
        Networks.TESTNET
      )
    ).rejects.toThrow('Network unavailable');
  });
});
