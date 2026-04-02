import { Transaction } from '@stellar/stellar-sdk';
import { horizonClient } from '../sdk';
import { SubmitResult } from '../types/transaction';
import { 
  HorizonSubmitError, 
  InsufficientBalanceError, 
  TransactionTimeoutError 
} from '../utils/errors';

/**
 * Submit a signed transaction to the Stellar network and handle all error cases.
 * @param tx Signed transaction
 * @returns {Promise<SubmitResult>}
 */
export async function submitTransaction(tx: Transaction): Promise<SubmitResult> {
  try {
    const response = await horizonClient.submitTransaction(tx);
    return {
      hash: response.hash,
      ledger: response.ledger,
      successful: true,
      resultXdr: response.result_xdr,
    };
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 504) {
        throw new TransactionTimeoutError(tx.hash().toString('hex'));
      }

      if (data && data.extras && data.extras.result_codes) {
        const { transaction: txCode, operations: opCodes } = data.extras.result_codes;

        if (txCode === 'tx_bad_seq') {
          throw new HorizonSubmitError('tx_bad_seq', opCodes);
        }
        if (txCode === 'tx_bad_auth') {
          throw new HorizonSubmitError('tx_bad_auth', opCodes);
        }
        if (opCodes && opCodes.includes('op_underfunded')) {
          throw new InsufficientBalanceError('unknown', 'unknown'); // We don't have easy access to required/available here
        }
        
        throw new HorizonSubmitError(txCode || 'unknown', opCodes);
      }
      
      throw new HorizonSubmitError(`HTTP_${status}`);
    }
    
    throw new HorizonSubmitError(error.message || 'Unknown error');
  }
}
