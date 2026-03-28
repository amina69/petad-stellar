import axios, { AxiosError } from "axios";
import { HorizonAccountResponse } from "./types";

export class HorizonNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Horizon: account not found — ${accountId}`);
    this.name = "HorizonNotFoundError";
  }
}

export class HorizonClient {
  private readonly baseUrl: string;

  constructor(baseUrl = "https://horizon-testnet.stellar.org") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Fetch a Stellar account from Horizon.
   * @throws {HorizonNotFoundError} when the account does not exist (HTTP 404).
   * @throws {Error} for any other network / server error.
   */
  async fetchAccount(accountId: string): Promise<HorizonAccountResponse> {
    try {
      const { data } = await axios.get<HorizonAccountResponse>(
        `${this.baseUrl}/accounts/${accountId}`
      );
      return data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.isAxiosError && axiosErr.response?.status === 404) {
        throw new HorizonNotFoundError(accountId);
      }
      throw err;
    }
  }
}