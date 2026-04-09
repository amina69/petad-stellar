// src/transactions/TransactionBuilder.ts

interface HorizonClient {
    fetchSequenceNumber: (account: string) => Promise<string>;
}

export class TransactionBuilder {
    private operations: object[] = [];
    private memo: string | null = null;
    private fee: number;
    private timeout: number;
    private horizonClient: HorizonClient;

    constructor(horizonClient: HorizonClient, maxFee: number = 100, transactionTimeout: number = 30) {
        this.horizonClient = horizonClient;
        this.fee = maxFee;
        this.timeout = transactionTimeout;
    }

    /**
     * Adds an operation to the transaction
     */
    addOperation(operation: object): this {
        this.operations.push(operation);
        return this;
    }

    /**
     * Sets the memo for the transaction
     */
    setMemo(memo: string): this {
        this.memo = memo;
        return this;
    }

    /**
     * Sets a custom timeout in seconds
     */
    setTimeout(seconds: number): this {
        this.timeout = seconds;
        return this;
    }

    /**
     * Fetches sequence number and returns the unsigned transaction object
     */
    async build(sourceAccount: string): Promise<object> {
        if (this.operations.length === 0) {
            throw new Error("Transaction must have at least one operation.");
        }

        // Fetch sequence number via fetchSequenceNumber() as required by task
        const sequenceNumber = await this.horizonClient.fetchSequenceNumber(sourceAccount);

        // Return unsigned transaction object
        return {
            sourceAccount,
            sequenceNumber: (BigInt(sequenceNumber) + 1n).toString(),
            operations: this.operations,
            memo: this.memo,
            fee: this.fee,
            timeoutSeconds: this.timeout,
            buildTime: new Date().toISOString()
        };
    }
}