import { buildMultisigTransaction, fetchTransactionOnce } from "../../../src/transactions";

describe("transactions module", () => {
  it("buildMultisigTransaction should return undefined (placeholder)", () => {
    expect(buildMultisigTransaction()).toBeUndefined();
  });
});

describe("fetchTransactionOnce", () => {
  const hash = "abc123";
  const baseUrl = "https://horizon-testnet.stellar.org/transactions/";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns found: true for successful transaction", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        successful: true,
        ledger: 123,
        created_at: "2024-01-01T00:00:00Z",
      }),
    }) as unknown as typeof fetch;

    const result = await fetchTransactionOnce(hash);

    expect(result).toEqual({
      found: true,
      successful: true,
      ledger: 123,
      createdAt: "2024-01-01T00:00:00Z",
    });

    expect(global.fetch).toHaveBeenCalledWith(baseUrl + hash);
  });

  it("returns found: true for failed transaction", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        successful: false,
        ledger: 456,
        created_at: "2024-01-02T00:00:00Z",
      }),
    }) as unknown as typeof fetch;

    const result = await fetchTransactionOnce(hash);

    expect(result).toEqual({
      found: true,
      successful: false,
      ledger: 456,
      createdAt: "2024-01-02T00:00:00Z",
    });
  });

  it("returns found: false for 404 response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 404,
      ok: false,
    }) as unknown as typeof fetch;

    const result = await fetchTransactionOnce(hash);

    expect(result).toEqual({ found: false });
  });

  it("throws error on network failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    await expect(fetchTransactionOnce(hash)).rejects.toThrow();
  });

  it("throws error on non-404 HTTP error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
    }) as unknown as typeof fetch;

    await expect(fetchTransactionOnce(hash)).rejects.toThrow();
  });
});