export interface CreateEscrowParams {
  adopterPublicKey: string;
  ownerPublicKey: string;
  depositAmount: string;
  adoptionFee?: string;
  unlockDate?: Date;
  metadata?: { adoptionId: string; petId: string };
}

export interface Signer {
  publicKey: string;
  weight: number;
}

export interface Thresholds {
  low: number;
  medium: number;
  high: number;
}

export interface EscrowAccount {
  accountId: string;
  transactionHash: string;
  signers: Signer[];
  thresholds: Thresholds;
  unlockDate?: Date;
}

export enum EscrowStatus {
  CREATED   = 'CREATED',
  FUNDED    = 'FUNDED',
  DISPUTED  = 'DISPUTED',
  SETTLING  = 'SETTLING',
  SETTLED   = 'SETTLED',
  NOT_FOUND = 'NOT_FOUND',
}
