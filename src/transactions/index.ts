export function buildMultisigTransaction(): void {
  // placeholder function
  return;
}

export async function fetchTransactionOnce(hash: string) {
  const url = `https://horizon-testnet.stellar.org/transactions/${hash}`;

  try {
    const res = await fetch(url);

    if (res.status === 404) {
      return { found: false };
    }

    if (!res.ok) {
      throw new Error("Horizon error");
    }

    const data = (await res.json()) as {
  successful: boolean;
  ledger: number;
  created_at: string;
};

    return {
      found: true,
      successful: data.successful,
      ledger: data.ledger,
      createdAt: data.created_at,
    };
  } catch {
    // ✅ fixed: removed unused "err"
    throw new Error("HorizonSubmitError");
  }
}