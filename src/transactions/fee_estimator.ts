import { Horizon } from '@stellar/stellar-sdk';

export const MAX_FEE = '10000000'; // 0.1 XLM in stroops

interface FeeStatsResponse {
  last_ledger: number;
  last_ledger_base_fee: number;
  ledger_capacity_usage: string;
  fee_charged: {
    min: number;
    max: number;
    mode: number;
    p10: number;
    p20: number;
    p30: number;
    p40: number;
    p50: number;
    p60: number;
    p70: number;
    p80: number;
    p90: number;
    p95: number;
    p99: number;
  };
  max_fee: {
    min: number;
    max: number;
    mode: number;
    p10: number;
    p20: number;
    p30: number;
    p40: number;
    p50: number;
    p60: number;
    p70: number;
    p80: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

interface CacheEntry {
  data: FeeStatsResponse;
  timestamp: number;
}

class FeeEstimator {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 60000; // 60 seconds in milliseconds
  private horizonServer: Horizon.Server;

  constructor(horizonUrl: string = 'https://horizon.stellar.org') {
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  private async fetchFeeStats(): Promise<FeeStatsResponse> {
    const now = Date.now();
    
    // Check cache first
    if (this.cache && (now - this.cache.timestamp) < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const response = await this.horizonServer.feeStats();
      const feeStats: FeeStatsResponse = response as FeeStatsResponse;
      
      // Update cache
      this.cache = {
        data: feeStats,
        timestamp: now
      };
      
      return feeStats;
    } catch (error) {
      // If Horizon is unavailable, swallow error and use fallback
      console.warn('Failed to fetch fee stats from Horizon, using fallback:', error);
      throw error;
    }
  }

  async estimateFee(operationCount: number): Promise<string> {
    if (operationCount <= 0) {
      throw new Error('Operation count must be greater than 0');
    }

    try {
      const feeStats = await this.fetchFeeStats();
      const recommendedFeePerOp = feeStats.fee_charged.p50;
      const totalFee = recommendedFeePerOp * operationCount;
      
      return totalFee.toString();
    } catch (error) {
      // Fallback to MAX_FEE per operation when Horizon is unavailable
      const fallbackFee = parseInt(MAX_FEE) * operationCount;
      return fallbackFee.toString();
    }
  }

  // Method to clear cache for testing purposes
  clearCache(): void {
    this.cache = null;
  }
}

// Default instance for convenience
const defaultFeeEstimator = new FeeEstimator();

/**
 * Estimate transaction fee based on current network conditions
 * @param operationCount - Number of operations in the transaction
 * @param horizonUrl - Optional Horizon server URL (defaults to public Horizon)
 * @returns Recommended fee in stroops as string
 */
export async function estimateFee(operationCount: number, horizonUrl?: string): Promise<string> {
  if (horizonUrl) {
    const customEstimator = new FeeEstimator(horizonUrl);
    return customEstimator.estimateFee(operationCount);
  }
  
  return defaultFeeEstimator.estimateFee(operationCount);
}

export { FeeEstimator };
