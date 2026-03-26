import {
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  NetworkError,
  NotFoundError,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { DEFAULT_TRANSACTION_TIMEOUT } from '../utils/constants';
import {
  AccountNotFoundError,
  FriendbotError,
  HorizonSubmitError,
  SdkError,
  ValidationError,
} from '../utils/errors';
import { isValidAmount, isValidPublicKey, isValidSecretKey } from '../utils/validation';
import { AccountInfo, KeypairResult } from '../types/network';
import { SubmitResult } from '../types/transaction';

export type HorizonClient = Pick<
  Horizon.Server,
  'fetchBaseFee' | 'friendbot' | 'loadAccount' | 'submitTransaction'
>;

export type StellarNetwork = 'testnet' | 'public';

export interface CreateAccountOptions {
  destination: string;
  startingBalance: string;
}

export interface ConfigureMultisigOptions {
  sourceSecretKey: string;
  signerPublicKey: string;
  signerWeight: number;
  masterWeight?: number;
  lowThreshold?: number;
  mediumThreshold?: number;
  highThreshold?: number;
}

export interface MergeAccountOptions {
  sourceSecretKey: string;
  destination: string;
}

function getNetworkPassphrase(network: StellarNetwork): string {
  return network === 'public' ? Networks.PUBLIC : Networks.TESTNET;
}

function wrapSdkError(error: unknown, context: { accountId?: string; publicKey?: string } = {}): SdkError {
  if (error instanceof SdkError) {
    return error;
  }

  if (error instanceof NotFoundError && context.accountId) {
    return new AccountNotFoundError(context.accountId);
  }

  if (error instanceof NetworkError) {
    const response = error.getResponse();
    const transactionError = response.data?.title === 'Transaction Failed' ? response.data : undefined;

    if (transactionError?.extras?.result_codes?.transaction) {
      return new HorizonSubmitError(
        transactionError.extras.result_codes.transaction,
        transactionError.extras.result_codes.operations ?? [],
      );
    }

    if (context.publicKey && typeof response.status === 'number') {
      return new FriendbotError(context.publicKey, response.status);
    }

    return new SdkError(error.message, 'HORIZON_NETWORK_ERROR', true);
  }

  if (error instanceof Error) {
    return new SdkError(error.message, 'SDK_ERROR', false);
  }

  return new SdkError('Unknown SDK error', 'SDK_ERROR', false);
}

async function buildAndSubmitTransaction(args: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  sourceSecretKey: string;
  operation: ReturnType<typeof Operation.createAccount>;
}): Promise<SubmitResult>;
async function buildAndSubmitTransaction(args: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  sourceSecretKey: string;
  operation: ReturnType<typeof Operation.setOptions>;
}): Promise<SubmitResult>;
async function buildAndSubmitTransaction(args: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  sourceSecretKey: string;
  operation: ReturnType<typeof Operation.accountMerge>;
}): Promise<SubmitResult>;
async function buildAndSubmitTransaction({
  horizonClient,
  network,
  sourceSecretKey,
  operation,
}: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  sourceSecretKey: string;
  operation:
    | ReturnType<typeof Operation.accountMerge>
    | ReturnType<typeof Operation.createAccount>
    | ReturnType<typeof Operation.setOptions>;
}): Promise<SubmitResult> {
  const sourceKeypair = Keypair.fromSecret(sourceSecretKey);
  const sourceAccount = await horizonClient.loadAccount(sourceKeypair.publicKey());

  const baseFee = await horizonClient.fetchBaseFee().catch(() => Number(BASE_FEE));
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: String(baseFee),
    networkPassphrase: getNetworkPassphrase(network),
  })
    .addOperation(operation)
    .setTimeout(DEFAULT_TRANSACTION_TIMEOUT)
    .build();

  transaction.sign(sourceKeypair);

  const result = await horizonClient.submitTransaction(transaction);

  return {
    successful: result.successful,
    hash: result.hash,
    ledger: result.ledger,
  };
}

export function generateAccount(): KeypairResult {
  try {
    const keypair = Keypair.random();

    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
    };
  } catch (error) {
    throw wrapSdkError(error);
  }
}

export async function createAccount(args: {
  horizonClient: HorizonClient;
  masterSecretKey: string;
  network: StellarNetwork;
  options: CreateAccountOptions;
}): Promise<SubmitResult> {
  const { horizonClient, masterSecretKey, network, options } = args;

  if (!isValidSecretKey(masterSecretKey)) {
    throw new ValidationError('masterSecretKey', 'Invalid Stellar secret key');
  }

  if (!isValidPublicKey(options.destination)) {
    throw new ValidationError('destination', 'Invalid Stellar public key');
  }

  if (!isValidAmount(options.startingBalance)) {
    throw new ValidationError('startingBalance', 'Invalid Stellar amount');
  }

  try {
    return await buildAndSubmitTransaction({
      horizonClient,
      network,
      sourceSecretKey: masterSecretKey,
      operation: Operation.createAccount({
        destination: options.destination,
        startingBalance: options.startingBalance,
      }),
    });
  } catch (error) {
    throw wrapSdkError(error, { accountId: options.destination });
  }
}

export async function verifyAccount(args: {
  horizonClient: HorizonClient;
  accountId: string;
}): Promise<AccountInfo> {
  const { horizonClient, accountId } = args;

  if (!isValidPublicKey(accountId)) {
    throw new ValidationError('accountId', 'Invalid Stellar public key');
  }

  try {
    const account = await horizonClient.loadAccount(accountId);
    const nativeBalance = account.balances.find(balance => balance.asset_type === 'native');

    return {
      accountId: account.accountId(),
      balance: nativeBalance?.balance ?? '0',
      signers: account.signers.map(signer => ({
        publicKey: signer.key,
        weight: signer.weight,
      })),
      thresholds: {
        low: account.thresholds.low_threshold,
        medium: account.thresholds.med_threshold,
        high: account.thresholds.high_threshold,
      },
      sequenceNumber: account.sequenceNumber(),
      exists: true,
    };
  } catch (error) {
    throw wrapSdkError(error, { accountId });
  }
}

export async function configureMultisigAccount(args: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  options: ConfigureMultisigOptions;
}): Promise<SubmitResult> {
  const { horizonClient, network, options } = args;

  if (!isValidSecretKey(options.sourceSecretKey)) {
    throw new ValidationError('sourceSecretKey', 'Invalid Stellar secret key');
  }

  if (!isValidPublicKey(options.signerPublicKey)) {
    throw new ValidationError('signerPublicKey', 'Invalid Stellar public key');
  }

  try {
    return await buildAndSubmitTransaction({
      horizonClient,
      network,
      sourceSecretKey: options.sourceSecretKey,
      operation: Operation.setOptions({
        signer: {
          ed25519PublicKey: options.signerPublicKey,
          weight: options.signerWeight,
        },
        masterWeight: options.masterWeight,
        lowThreshold: options.lowThreshold,
        medThreshold: options.mediumThreshold,
        highThreshold: options.highThreshold,
      }),
    });
  } catch (error) {
    throw wrapSdkError(error, {
      accountId: Keypair.fromSecret(options.sourceSecretKey).publicKey(),
    });
  }
}

export async function mergeAccount(args: {
  horizonClient: HorizonClient;
  network: StellarNetwork;
  options: MergeAccountOptions;
}): Promise<SubmitResult> {
  const { horizonClient, network, options } = args;

  if (!isValidSecretKey(options.sourceSecretKey)) {
    throw new ValidationError('sourceSecretKey', 'Invalid Stellar secret key');
  }

  if (!isValidPublicKey(options.destination)) {
    throw new ValidationError('destination', 'Invalid Stellar public key');
  }

  try {
    return await buildAndSubmitTransaction({
      horizonClient,
      network,
      sourceSecretKey: options.sourceSecretKey,
      operation: Operation.accountMerge({
        destination: options.destination,
      }),
    });
  } catch (error) {
    throw wrapSdkError(error, {
      accountId: Keypair.fromSecret(options.sourceSecretKey).publicKey(),
    });
  }
}

export async function fundTestnetAccount(args: {
  horizonClient: HorizonClient;
  publicKey: string;
}): Promise<void> {
  const { horizonClient, publicKey } = args;

  if (!isValidPublicKey(publicKey)) {
    throw new ValidationError('publicKey', 'Invalid Stellar public key');
  }

  try {
    await horizonClient.friendbot(publicKey).call();
  } catch (error) {
    throw wrapSdkError(error, { publicKey });
  }
}
