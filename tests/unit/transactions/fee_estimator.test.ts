import { FeeEstimator, estimateFee, MAX_FEE } from '../../../src/transactions/fee_estimator';
import { Horizon } from '@stellar/stellar-sdk';

// Mock the Stellar SDK Horizon Server
jest.mock('@stellar/stellar-sdk', () => {
  const originalModule = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...originalModule,
    Horizon: {
      ...originalModule.Horizon,
      Server: jest.fn().mockImplementation(() => ({
        feeStats: jest.fn(),
      })),
    },
  };
});

describe('FeeEstimator', () => {
  let feeEstimator: FeeEstimator;
  let mockServer: jest.Mocked<Horizon.Server>;

  beforeEach(() => {
    jest.clearAllMocks();
    feeEstimator = new FeeEstimator('https://testhorizon.stellar.org');
    mockServer = (feeEstimator as any).horizonServer;
  });

  describe('estimateFee', () => {
    const mockFeeStats = {
      last_ledger: 123456,
      last_ledger_base_fee: 100,
      ledger_capacity_usage: '0.5',
      fee_charged: {
        min: 100,
        max: 1000,
        mode: 200,
        p10: 150,
        p20: 160,
        p30: 170,
        p40: 180,
        p50: 200, // This is what we use for calculation
        p60: 220,
        p70: 240,
        p80: 260,
        p90: 300,
        p95: 350,
        p99: 500,
      },
      max_fee: {
        min: 100,
        max: 1000,
        mode: 200,
        p10: 150,
        p20: 160,
        p30: 170,
        p40: 180,
        p50: 200,
        p60: 220,
        p70: 240,
        p80: 260,
        p90: 300,
        p95: 350,
        p99: 500,
      },
    };

    it('should calculate fee correctly from mock fee_stats', async () => {
      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      const result = await feeEstimator.estimateFee(3);
      
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1);
      expect(result).toBe('600'); // 200 (p50) * 3 operations
    });

    it('should handle single operation', async () => {
      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      const result = await feeEstimator.estimateFee(1);
      
      expect(result).toBe('200'); // 200 (p50) * 1 operation
    });

    it('should handle multiple operations', async () => {
      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      const result = await feeEstimator.estimateFee(10);
      
      expect(result).toBe('2000'); // 200 (p50) * 10 operations
    });

    it('should throw error for zero operation count', async () => {
      await expect(feeEstimator.estimateFee(0)).rejects.toThrow('Operation count must be greater than 0');
    });

    it('should throw error for negative operation count', async () => {
      await expect(feeEstimator.estimateFee(-1)).rejects.toThrow('Operation count must be greater than 0');
    });

    it('should use fallback when Horizon is unavailable', async () => {
      mockServer.feeStats.mockRejectedValue(new Error('Network error'));

      const result = await feeEstimator.estimateFee(2);
      
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1);
      expect(result).toBe((parseInt(MAX_FEE) * 2).toString());
    });

    it('should cache fee_stats response for 60 seconds', async () => {
      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      // First call should fetch from Horizon
      const result1 = await feeEstimator.estimateFee(1);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1);
      expect(result1).toBe('200');

      // Second call within cache window should use cache
      const result2 = await feeEstimator.estimateFee(2);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toBe('400');
    });

    it('should fetch fresh data after cache expires', async () => {
      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      // First call
      await feeEstimator.estimateFee(1);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1);

      // Manually clear cache to simulate expiration
      feeEstimator.clearCache();

      // Second call should fetch again
      await feeEstimator.estimateFee(1);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(2);
    });

    it('should handle different p50 values correctly', async () => {
      const customFeeStats = {
        ...mockFeeStats,
        fee_charged: {
          ...mockFeeStats.fee_charged,
          p50: 500, // Higher p50 value
        },
      };
      mockServer.feeStats.mockResolvedValue(customFeeStats);

      const result = await feeEstimator.estimateFee(2);
      
      expect(result).toBe('1000'); // 500 (p50) * 2 operations
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const mockFeeStats = {
        last_ledger: 123456,
        last_ledger_base_fee: 100,
        ledger_capacity_usage: '0.5',
        fee_charged: {
          min: 100,
          max: 1000,
          mode: 200,
          p10: 150,
          p20: 160,
          p30: 170,
          p40: 180,
          p50: 200,
          p60: 220,
          p70: 240,
          p80: 260,
          p90: 300,
          p95: 350,
          p99: 500,
        },
        max_fee: {
          min: 100,
          max: 1000,
          mode: 200,
          p10: 150,
          p20: 160,
          p30: 170,
          p40: 180,
          p50: 200,
          p60: 220,
          p70: 240,
          p80: 260,
          p90: 300,
          p95: 350,
          p99: 500,
        },
      };

      mockServer.feeStats.mockResolvedValue(mockFeeStats);

      // First call
      await feeEstimator.estimateFee(1);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(1);

      // Clear cache
      feeEstimator.clearCache();

      // Second call should fetch again
      await feeEstimator.estimateFee(1);
      expect(mockServer.feeStats).toHaveBeenCalledTimes(2);
    });
  });
});

describe('estimateFee (standalone function)', () => {
  const mockFeeStats = {
    last_ledger: 123456,
    last_ledger_base_fee: 100,
    ledger_capacity_usage: '0.5',
    fee_charged: {
      min: 100,
      max: 1000,
      mode: 200,
      p10: 150,
      p20: 160,
      p30: 170,
      p40: 180,
      p50: 300, // Different p50 for standalone test
      p60: 220,
      p70: 240,
      p80: 260,
      p90: 300,
      p95: 350,
      p99: 500,
    },
    max_fee: {
      min: 100,
      max: 1000,
      mode: 200,
      p10: 150,
      p20: 160,
      p30: 170,
      p40: 180,
      p50: 200,
      p60: 220,
      p70: 240,
      p80: 260,
      p90: 300,
      p95: 350,
      p99: 500,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use default fee estimator when no custom horizon URL provided', async () => {
    const mockServer = new (Horizon.Server as any)('https://horizon.stellar.org');
    mockServer.feeStats.mockResolvedValue(mockFeeStats);

    const result = await estimateFee(2);
    
    expect(result).toBe('600'); // 300 (p50) * 2 operations
  });

  it('should create custom fee estimator when horizon URL provided', async () => {
    const result = await estimateFee(3, 'https://customhorizon.stellar.org');
    
    // Should use fallback since we're not mocking the custom horizon server
    expect(result).toBe((parseInt(MAX_FEE) * 3).toString());
  });
});
