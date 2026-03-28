import * as StellarSdk from '@stellar/stellar-sdk';

export interface FriendbotResult {
  funded: boolean;
  amount?: string;
  reason?: string;
}

export class FriendbotError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'FriendbotError';
  }
}

/**
 * Funds a testnet account using the Stellar Friendbot service
 * @param publicKey - Stellar public key to fund
 * @returns Promise<FriendbotResult> - Funding result
 * @throws FriendbotError - When funding fails after retries
 * @throws Error - When called on mainnet or with invalid public key
 */
export async function fundTestnetAccount(publicKey: string): Promise<FriendbotResult> {
  // Validate public key format
  if (!isValidPublicKey(publicKey)) {
    throw new Error('Invalid public key format');
  }

  // Guard: only callable on testnet
  const isTestnet = (process.env['STELLAR_NETWORK'] ?? 'testnet') === 'testnet';
  if (!isTestnet) {
    throw new Error('Friendbot funding is only available on testnet network');
  }

  const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`;

  try {
    return await attemptFunding(friendbotUrl);
  } catch (error) {
    if (error instanceof FriendbotError && error.statusCode && error.statusCode >= 500 && error.statusCode < 600) {
      // Retry once after 2s for 5xx errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await attemptFunding(friendbotUrl);
    }
    throw error;
  }
}

async function attemptFunding(url: string): Promise<FriendbotResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 200) {
      await response.json();
      return {
        funded: true,
        amount: "10000"
      };
    } else if (response.status === 400) {
      // Account already funded
      return {
        funded: false,
        reason: "already_funded"
      };
    } else if (response.status >= 500 && response.status < 600) {
      // Server error - throw for retry logic
      throw new FriendbotError(`Friendbot server error: ${response.status}`, response.status);
    } else {
      // Other errors
      const errorText = await response.text();
      throw new FriendbotError(`Friendbot error: ${response.status} - ${errorText}`, response.status);
    }
  } catch (error) {
    if (error instanceof FriendbotError) {
      throw error;
    }
    // Network or other errors
    throw new FriendbotError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates if a string is a valid Stellar public key
 * @param publicKey - Public key to validate
 * @returns boolean - True if valid
 */
function isValidPublicKey(publicKey: string): boolean {
  try {
    StellarSdk.Keypair.fromPublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
}
