import Server from '@stellar/stellar-sdk';
import * as crypto from 'crypto';
import { CreateEscrowParams, EscrowAccount, SDKConfig } from '../types';

interface CacheEntry {
  account: EscrowAccount | null;
  timestamp: number;
}

const escrowCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Helper function to find an escrow account by adoptionId
 * Queries Horizon for accounts with memo matching adoptionId hash
 */
async function findEscrowByAdoptionId(
  adoptionId: string,
  horizonUrl: string,
): Promise<EscrowAccount | null> {
  // Check cache first
  const cacheKey = `${adoptionId}:${horizonUrl}`;
  const cached = escrowCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.account;
  }

  try {
    const server = new Server(horizonUrl);
    const adoptionIdHash = crypto.createHash('sha256').update(adoptionId).digest('hex');

    // Search for accounts with memo matching the adoptionId hash
    const accounts = await server.accounts().forSigner(adoptionIdHash).call();

    if (accounts.records.length > 0) {
      const account = accounts.records[0];
      const escrowAccount: EscrowAccount = {
        accountId: account.id,
        transactionHash: '', // Will be populated when actual implementation is done
        signers:
          (account.signers || []).map((signer: any) => ({
            // eslint-disable-line @typescript-eslint/no-explicit-any
            publicKey: signer.key,
            weight: signer.weight,
          })) || [],
        thresholds: {
          low: account.thresholds.low_threshold,
          medium: account.thresholds.med_threshold,
          high: account.thresholds.high_threshold,
        },
      };

      // Cache the result
      escrowCache.set(cacheKey, {
        account: escrowAccount,
        timestamp: Date.now(),
      });

      return escrowAccount;
    }

    // Cache the null result
    escrowCache.set(cacheKey, {
      account: null,
      timestamp: Date.now(),
    });

    return null;
  } catch (error) {
    // Cache the null result on error
    escrowCache.set(cacheKey, {
      account: null,
      timestamp: Date.now(),
    });
    return null;
  }
}

/**
 * Creates an escrow account with idempotency check
 * Before creating, checks if an escrow with the same adoptionId memo already exists on-chain
 */
export async function createEscrowAccount(
  params: CreateEscrowParams,
  config: SDKConfig,
): Promise<EscrowAccount> {
  // If metadata with adoptionId is provided, check for existing escrow
  if (params.metadata?.adoptionId) {
    const existingEscrow = await findEscrowByAdoptionId(
      params.metadata.adoptionId,
      config.horizonUrl,
    );

    if (existingEscrow) {
      return existingEscrow;
    }
  }

  // If no existing escrow found, proceed with creation
  // This is a placeholder for the actual escrow creation logic
  // In a real implementation, this would create a new Stellar account
  // with the appropriate signers and settings

  throw new Error('Escrow creation not yet implemented - no existing account found');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lockCustodyFunds(..._args: unknown[]): unknown {
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function anchorTrustHash(..._args: unknown[]): unknown {
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifyEventHash(..._args: unknown[]): unknown {
  return undefined;
}
