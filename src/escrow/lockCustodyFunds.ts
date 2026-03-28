import {
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