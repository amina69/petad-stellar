import { Keypair, Networks, Account } from '@stellar/stellar-sdk';
import {
  createEscrowAccount,
  lockCustodyFunds,
  anchorTrustHash,
  verifyEventHash,
} from '../../../src/escrow';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const custodianKp = Keypair.random();
const ownerKp     = Keypair.random();
const platformKp  = Keypair.random();

describe('escrow module placeholders', () => {
  it('createEscrowAccount is a callable placeholder', () => {
    expect(createEscrowAccount()).toBeUndefined();
  });

  it('anchorTrustHash is a callable placeholder', () => {
    expect(anchorTrustHash()).toBeUndefined();
  });

  it('verifyEventHash is a callable placeholder', () => {
    expect(verifyEventHash()).toBeUndefined();
  });
});

describe('escrow module — lockCustodyFunds smoke test', () => {
  it('returns a LockResult with unlockDate and conditionsHash', () => {
    const result = lockCustodyFunds({
      custodianPublicKey: custodianKp.publicKey(),
      ownerPublicKey:     ownerKp.publicKey(),
      platformPublicKey:  platformKp.publicKey(),
      depositAmount:      '100.00',
      durationDays:       30,
      escrowAccount:      new Account(platformKp.publicKey(), '0'),
      networkPassphrase:  Networks.TESTNET,
    });

    expect(result.unlockDate).toBeInstanceOf(Date);
    expect(result.conditionsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.escrowPublicKey).toBeTruthy();
    expect(result.transaction).toBeDefined();
  });
});