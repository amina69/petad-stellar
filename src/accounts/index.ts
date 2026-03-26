import {
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  NotFoundError,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { AccountInfo, SDKConfig } from '../types/network';
import { DEFAULT_MAX_FEE } from '../utils/constants';
import { AccountNotFoundError, HorizonSubmitError, ValidationError } from '../utils/errors';
import { isValidPublicKey } from '../utils/validation';

interface HorizonAccountResponse {
  id: string;
  sequence: string;
  balances?: Array<{
    asset_type?: string;
    balance?: string;
  }>;
  signers?: Array<{
    key: string;
    weight: number;
  }>;
  thresholds?: {
    low_threshold?: number;
    med_threshold?: number;
    high_threshold?: number;
  };
}

const DEFAULT_HORIZON_URL = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

export interface CreateAccountParams {
  publicKey: string;
  startingBalance?: string;
}

export interface CreateAccountResult {
  accountId: string;
  transactionHash: string;
  startingBalance: string;
}

interface HorizonClient {
  loadAccount(accountId: string): Promise<TransactionSourceAccount>;
  fetchBaseFee(): Promise<number>;
  submitTransaction(transaction: unknown): Promise<{ hash: string }>;
}

interface TransactionSourceAccount {
  accountId(): string;
  sequenceNumber(): string;
  incrementSequenceNumber(): void;
}

function buildMissingAccountInfo(publicKey: string): AccountInfo {
  return {
    accountId: publicKey,
    balance: '0',
    signers: [],
    thresholds: {
      low: 0,
      medium: 0,
      high: 0,
    },
    sequenceNumber: '0',
    exists: false,
  };
}

function mapAccountInfo(account: HorizonAccountResponse): AccountInfo {
  const nativeBalance = account.balances?.find(balance => balance.asset_type === 'native')?.balance || '0';

  return {
    accountId: account.id,
    balance: nativeBalance,
    signers: (account.signers || []).map(signer => ({
      publicKey: signer.key,
      weight: signer.weight,
    })),
    thresholds: {
      low: account.thresholds?.low_threshold || 0,
      medium: account.thresholds?.med_threshold || 0,
      high: account.thresholds?.high_threshold || 0,
    },
    sequenceNumber: account.sequence,
    exists: true,
  };
}

export async function verifyAccount(
  publicKey: string,
  horizonUrl: string = DEFAULT_HORIZON_URL,
): Promise<AccountInfo> {
  if (!isValidPublicKey(publicKey)) {
    throw new ValidationError('publicKey', 'Invalid Stellar public key');
  }

  let response: Response;

  try {
    response = await fetch(`${horizonUrl.replace(/\/$/, '')}/accounts/${publicKey}`);
  } catch {
    throw new HorizonSubmitError('network_error');
  }

  if (response.status === 404) {
    return buildMissingAccountInfo(publicKey);
  }

  if (!response.ok) {
    throw new HorizonSubmitError(`http_${response.status}`);
  }

  const account = (await response.json()) as HorizonAccountResponse;
  return mapAccountInfo(account);
}

function getNetworkPassphrase(config: SDKConfig): string {
  if (config.networkPassphrase) {
    return config.networkPassphrase;
  }

  return config.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;
}

function createHorizonClient(horizonUrl: string): HorizonClient {
  return new Horizon.Server(horizonUrl, {
    allowHttp: horizonUrl.startsWith('http://'),
  });
}

export async function createAccount(
  params: CreateAccountParams,
  config: SDKConfig,
  horizonClient: HorizonClient = createHorizonClient(config.horizonUrl),
): Promise<CreateAccountResult> {
  const { publicKey, startingBalance = '2.5' } = params;

  if (!isValidPublicKey(publicKey)) {
    throw new ValidationError('publicKey', 'Invalid Stellar public key');
  }

  const masterKeypair = Keypair.fromSecret(config.masterSecretKey);

  let masterAccount: TransactionSourceAccount;
  try {
    masterAccount = await horizonClient.loadAccount(masterKeypair.publicKey());
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new AccountNotFoundError(masterKeypair.publicKey());
    }

    throw new HorizonSubmitError('load_account_failed');
  }

  try {
    const fee = String(config.maxFee || (await horizonClient.fetchBaseFee()) || DEFAULT_MAX_FEE || BASE_FEE);
    const transaction = new TransactionBuilder(masterAccount, {
      fee,
      networkPassphrase: getNetworkPassphrase(config),
    })
      .addOperation(Operation.createAccount({
        destination: publicKey,
        startingBalance,
      }))
      .setTimeout(config.transactionTimeout || 180)
      .build();

    transaction.sign(masterKeypair);

    const response = await horizonClient.submitTransaction(transaction);

    return {
      accountId: publicKey,
      transactionHash: response.hash,
      startingBalance,
    };
  } catch (error) {
    if (error instanceof AccountNotFoundError || error instanceof ValidationError) {
      throw error;
    }

    const resultCode = error instanceof Error ? error.message : 'submit_failed';
    throw new HorizonSubmitError(resultCode);
  }
}
