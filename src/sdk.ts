import { Horizon } from '@stellar/stellar-sdk';
import { TESTNET_HORIZON_URL } from './utils/constants';
import { SDKConfig } from './types/network';

export const horizonClient = new Horizon.Server(TESTNET_HORIZON_URL);

export class StellarSDK {
  constructor(public config: SDKConfig) {}
}
