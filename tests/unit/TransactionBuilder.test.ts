import { TransactionBuilder } from '../../src/transactions/TransactionBuilder';

interface BuiltTransaction {
    memo: string;
    timeoutSeconds: number;
    fee: number;
    operations: object[];
}

describe('TransactionBuilder Unit Tests', () => {
    const mockHorizon = {
        fetchSequenceNumber: async (_account: string) => "100"
    };

    it('should correctly set memo, timeout, and operations', async () => {
        const builder = new TransactionBuilder(mockHorizon, 150, 45);

        builder.addOperation({ type: 'payment', amount: '10' })
            .setMemo('TestMemo')
            .setTimeout(90);

        const tx = await builder.build('G...SOURCE_ACCOUNT') as unknown as BuiltTransaction;

        if (tx.memo !== 'TestMemo') throw new Error('Memo was not set correctly');
        if (tx.timeoutSeconds !== 90) throw new Error('Timeout was not applied');
        if (tx.fee !== 150) throw new Error('Base fee was not used');
        if (tx.operations.length !== 1) throw new Error('Operation was not added');

        console.log("✅ SUCCESS: All TransactionBuilder requirements verified!");
    });
});