import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Memo,
} from '@stellar/stellar-sdk';
import crypto from 'crypto';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

type LockCustodyFundsParams = {
  custodianPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  durationDays: number;
};

type LockResult = {
  escrowAccountId: string;
  unlockDate: Date;
  conditionsHash: string;
};

const PLATFORM_PUBLIC_KEY = process.env.PLATFORM_PUBLIC_KEY!;
const OWNER_SECRET = process.env.OWNER_SECRET!;

// -----------------------------
// Deterministic hash
// -----------------------------
function hashData(data: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// -----------------------------
// MAIN FUNCTION
// -----------------------------
export async function lockCustodyFunds(params: LockCustodyFundsParams): Promise<LockResult> {
  const { custodianPublicKey, ownerPublicKey, depositAmount, durationDays } = params;

  // -----------------------------
  //  VALIDATION
  // -----------------------------
  if (!custodianPublicKey || !ownerPublicKey) {
    throw new Error('Invalid public keys');
  }

  if (custodianPublicKey === ownerPublicKey) {
    throw new Error('Custodian and owner must differ');
  }

  if (!depositAmount || Number(depositAmount) <= 0) {
    throw new Error('Deposit must be > 0');
  }

  if (!durationDays || durationDays <= 0) {
    throw new Error('durationDays must be > 0');
  }

  // -----------------------------
  //  CONDITIONS HASH
  // -----------------------------
  const conditions = {
    noViolations: true,
    petReturned: true,
  };

  const conditionsHash = hashData(conditions);

  // ----------------------------
  //  UNLOCK DATE
  // -----------------------------
  const now = Date.now();
  const unlockDate = new Date(now + durationDays * 86400000);

  // -----------------------------
  //  ESCROW ACCOUNT CREATION
  // -----------------------------
  const escrowKeypair = Keypair.random();

  const sourceAccount = await server.loadAccount(ownerPublicKey);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.createAccount({
        destination: escrowKeypair.publicKey(),
        startingBalance: depositAmount,
      }),
    )

    // Add signers
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: custodianPublicKey,
          weight: 1,
        },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: ownerPublicKey,
          weight: 1,
        },
      }),
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: PLATFORM_PUBLIC_KEY,
          weight: 1,
        },
      }),
    )

    // Multisig config
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        masterWeight: 0,
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2,
      }),
    )

    // Memo (max 28 bytes)
    .addMemo(Memo.text(conditionsHash.slice(0, 28)))
    .setTimeout(0)
    .build();

  tx.sign(Keypair.fromSecret(OWNER_SECRET));
  tx.sign(escrowKeypair);

  await server.submitTransaction(tx);

  return {
    escrowAccountId: escrowKeypair.publicKey(),
    unlockDate,
    conditionsHash,
  };
}
