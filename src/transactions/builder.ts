import { Operation, xdr } from '@stellar/stellar-sdk';

import { ValidationError } from '../utils/errors';
import { isValidPublicKey } from '../utils/validation';

export interface SetOptionsSignerInput {
  publicKey: string;
  weight: number;
}

export interface SetOptionsThresholdsInput {
  low: number;
  medium: number;
  high: number;
}

export interface BuildSetOptionsOpParams {
  signers?: SetOptionsSignerInput[];
  thresholds?: SetOptionsThresholdsInput;
  masterWeight?: number;
}

function validateUint8Field(field: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new ValidationError(field, 'Must be an integer between 0 and 255');
  }
}

export function buildSetOptionsOp(params: BuildSetOptionsOpParams): xdr.Operation[] {
  const operations: xdr.Operation[] = [];

  if (params.signers) {
    params.signers.forEach((signer, index) => {
      if (!isValidPublicKey(signer.publicKey)) {
        throw new ValidationError(`signers[${index}].publicKey`, 'Invalid public key');
      }

      validateUint8Field(`signers[${index}].weight`, signer.weight);

      operations.push(
        Operation.setOptions({
          signer: {
            ed25519PublicKey: signer.publicKey,
            weight: signer.weight,
          },
        }),
      );
    });
  }

  if (params.masterWeight !== undefined) {
    validateUint8Field('masterWeight', params.masterWeight);
  }

  if (params.thresholds) {
    validateUint8Field('thresholds.low', params.thresholds.low);
    validateUint8Field('thresholds.medium', params.thresholds.medium);
    validateUint8Field('thresholds.high', params.thresholds.high);
  }

  if (params.masterWeight !== undefined || params.thresholds) {
    operations.push(
      Operation.setOptions({
        ...(params.masterWeight !== undefined ? { masterWeight: params.masterWeight } : {}),
        ...(params.thresholds
          ? {
              lowThreshold: params.thresholds.low,
              medThreshold: params.thresholds.medium,
              highThreshold: params.thresholds.high,
            }
          : {}),
      }),
    );
  }

  return operations;
}