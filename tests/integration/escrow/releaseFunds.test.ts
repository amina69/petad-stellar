import { Horizon, Keypair } from '@stellar/stellar-sdk';
import { releaseFunds } from '../../../src/escrow';
import { asPercentage } from '../../../src/types/escrow';
import {
  TESTNET_HORIZON_URL,
  TESTNET_PASSPHRASE,
} from '../../../src/utils/constants';

const FRIEND_BOT_URL = 'https://friendbot.stellar.org';
const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? TESTNET_HORIZON_URL;
const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE ?? TESTNET_PASSPHRASE;

function amountToStroops(amount: string): bigint {
  const [wholePart, fractionalPart = ''] = amount.split('.');
  const normalizedFraction = `${fractionalPart}0000000`.slice(0, 7);
  return BigInt(wholePart) * 10_000_000n + BigInt(normalizedFraction);
}

function getNativeBalance(account: Awaited<ReturnType<Horizon.Server['loadAccount']>>): string {
  const nativeBalance = account.balances.find(balance => balance.asset_type === 'native');
  if (!nativeBalance) {
    throw new Error(`Native balance not found for ${account.accountId()}`);
  }

  return nativeBalance.balance;
}

async function fundWithFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIEND_BOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) {
    throw new Error(`Friendbot funding failed for ${publicKey}: HTTP ${response.status}`);
  }
}

describe('releaseFunds integration', () => {
  jest.setTimeout(120000);

  it('submits a real 60/40 release on testnet and changes recipient balances on-chain', async () => {
    const server = new Horizon.Server(HORIZON_URL);
    const source = Keypair.random();
    const recipientA = Keypair.random();
    const recipientB = Keypair.random();

    await fundWithFriendbot(source.publicKey());
    await fundWithFriendbot(recipientA.publicKey());
    await fundWithFriendbot(recipientB.publicKey());

    const beforeA = await server.loadAccount(recipientA.publicKey());
    const beforeB = await server.loadAccount(recipientB.publicKey());

    const result = await releaseFunds(
      {
        escrowAccountId: source.publicKey(),
        sourceSecretKey: source.secret(),
        balance: '10.0000000',
        distribution: [
          { recipient: recipientA.publicKey(), percentage: asPercentage(60) },
          { recipient: recipientB.publicKey(), percentage: asPercentage(40) },
        ],
      },
      {
        server,
        networkPassphrase: NETWORK_PASSPHRASE,
        maxSubmitAttempts: 1,
      },
    );

    const afterA = await server.loadAccount(recipientA.publicKey());
    const afterB = await server.loadAccount(recipientB.publicKey());

    expect(result.successful).toBe(true);
    expect(result.payments).toEqual([
      { recipient: recipientA.publicKey(), amount: '6.0000000' },
      { recipient: recipientB.publicKey(), amount: '4.0000000' },
    ]);

    expect(
      amountToStroops(getNativeBalance(afterA)) -
      amountToStroops(getNativeBalance(beforeA)),
    ).toBe(amountToStroops('6.0000000'));
    expect(
      amountToStroops(getNativeBalance(afterB)) -
      amountToStroops(getNativeBalance(beforeB)),
    ).toBe(amountToStroops('4.0000000'));
  });
});
