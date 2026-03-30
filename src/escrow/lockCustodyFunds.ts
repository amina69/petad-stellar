import {

  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Memo,
} from "@stellar/stellar-sdk";
import * as crypto from "crypto";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

const PLATFORM_PUBLIC_KEY = process.env.PLATFORM_PUBLIC_KEY ?? "";
const OWNER_SECRET = process.env.OWNER_SECRET ?? "";

function hashData(data: Record<string, unknown>): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
}

export async function lockCustodyFunds(params: {
  custodianPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  durationDays: number;
}) {
  const { custodianPublicKey, ownerPublicKey, depositAmount, durationDays } = params;

  if (!custodianPublicKey || !ownerPublicKey) {
    throw new Error("Invalid public keys");
  }

  if (custodianPublicKey === ownerPublicKey) {
    throw new Error("Custodian and owner must differ");
  }

  if (Number(depositAmount) <= 0) {
    throw new Error("Deposit must be > 0");
  }

  if (durationDays <= 0) {
    throw new Error("durationDays must be > 0");

  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Account,
  Transaction,
} from '@stellar/stellar-sdk';

import { ValidationError } from '../utils/errors';
import { isValidPublicKey, isValidAmount } from '../utils/validation';
import { hashData } from './index'; // keep only what you use

// ─── Types ─────────────────────────────────────────────────────────

export interface LockCustodyFundsParams {
  custodianPublicKey: string;
  ownerPublicKey: string;
  platformPublicKey: string;
  sourceKeypair: Keypair;
  depositAmount: string;
  durationDays: number;
}

export interface LockResult {
  unlockDate: Date;
  conditionsHash: string;
  escrowPublicKey: string;
  transactionHash: string;
}

const MS_PER_DAY = 86_400_000;

// ─── MAIN FUNCTION ─────────────────────────────────────────────────

export async function lockCustodyFunds(
  params: LockCustodyFundsParams,
  horizonServer: {
    loadAccount: (publicKey: string) => Promise<Account | { sequence: string }>;
    submitTransaction: (tx: Transaction) => Promise<{ hash: string }>;
  },
  networkPassphrase: string = Networks.TESTNET,
): Promise<LockResult> {
  const {
    custodianPublicKey,
    ownerPublicKey,
    platformPublicKey,
    sourceKeypair,
    depositAmount,
    durationDays,
  } = params;

  if (!isValidPublicKey(custodianPublicKey)) {
    throw new ValidationError('custodianPublicKey', 'Invalid public key');
  }
  if (!isValidPublicKey(ownerPublicKey)) {
    throw new ValidationError('ownerPublicKey', 'Invalid public key');
  }
  if (!isValidPublicKey(platformPublicKey)) {
    throw new ValidationError('platformPublicKey', 'Invalid public key');
  }
  if (!isValidAmount(depositAmount)) {
    throw new ValidationError('depositAmount', 'Invalid deposit amount');
  }
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    throw new ValidationError('durationDays', 'Invalid durationDays');

  }

  const conditionsHash = hashData({
    noViolations: true,
    petReturned: true,
  });


  const unlockDate = new Date(Date.now() + durationDays * 86400000);

  const escrowKeypair = Keypair.random();
  const sourceAccount = await server.loadAccount(ownerPublicKey);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,

  const unlockDate = new Date(Date.now() + durationDays * MS_PER_DAY);

  const escrowKeypair = Keypair.random();

  const loaded = await horizonServer.loadAccount(sourceKeypair.publicKey());

  const sourceAccount =
    loaded instanceof Account
      ? loaded
      : new Account(sourceKeypair.publicKey(), loaded.sequence);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,

  })
    .addOperation(
      Operation.createAccount({
        destination: escrowKeypair.publicKey(),
        startingBalance: depositAmount,

      })
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: custodianPublicKey,
          weight: 1,
        },
      })
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: ownerPublicKey,
          weight: 1,
        },
      })
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        signer: {
          ed25519PublicKey: PLATFORM_PUBLIC_KEY,
          weight: 1,
        },
      })
    )
    .addOperation(
      Operation.setOptions({
        source: escrowKeypair.publicKey(),
        masterWeight: 0,
        lowThreshold: 2,
        medThreshold: 2,
        highThreshold: 2,
      })
    )
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

      }),
    )
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair, escrowKeypair);

  const result = await horizonServer.submitTransaction(tx);

  return {
    unlockDate,
    conditionsHash,
    escrowPublicKey: escrowKeypair.publicKey(),
    transactionHash: result.hash,

  };
}