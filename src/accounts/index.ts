import { AccountInfo } from '../types/network';
import { HorizonSubmitError, ValidationError } from '../utils/errors';
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
