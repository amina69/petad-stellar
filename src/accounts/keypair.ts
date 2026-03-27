import * as StellarSdk from '@stellar/stellar-sdk';

export interface KeypairResult {
  publicKey: string;
  secretKey: string;
}

/**
 * Generates a secure random Stellar keypair
 * @returns {KeypairResult} Object containing publicKey and secretKey
 * 
 * SECURITY WARNING: Never log or expose the secretKey in production code.
 * The secretKey provides full control over the Stellar account and should be
 * treated as highly sensitive information.
 */
export function generateKeypair(): KeypairResult {
  const keypair = StellarSdk.Keypair.random();
  
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
}
