/**
 * Barrel export for the multisig module.
 *
 * Usage:
 *   import { configureMultisig, ValidationError } from './multisig';
 */
export { configureMultisig, MultisigResult } from './builder';
export { validateMultisigConfig, ValidationError, MultisigConfig, SignerConfig, Thresholds } from './validation';
