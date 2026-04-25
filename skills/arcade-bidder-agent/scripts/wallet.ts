import { randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const command = process.argv[2] ?? "help";
const amount = process.argv[3];
const chain = (process.env.ARCADE_CHAIN ?? "arcTestnet") as "arcTestnet";

if (command === "create") {
  const privateKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  console.log(JSON.stringify({ privateKey, address: account.address }, null, 2));
  process.exit(0);
}

if (command === "help" || !["address", "balances", "deposit"].includes(command)) {
  console.log(`Arcad(e) bidder wallet helper

Commands:
  create              Generate a fresh EVM private key and address
  address             Print address for ARCADE_BUYER_PRIVATE_KEY
  balances            Show wallet and Circle Gateway balances
  deposit <amount>    Deposit USDC into Circle Gateway, e.g. deposit 1.00

Env:
  ARCADE_BUYER_PRIVATE_KEY=0x...
  ARCADE_CHAIN=arcTestnet
  ARCADE_RPC_URL=https://...

Funding:
  1. Run: wallet.ts create
  2. Fund the printed address with Arc Testnet USDC from Circle Faucet
  3. Export ARCADE_BUYER_PRIVATE_KEY
  4. Run: wallet.ts deposit 1.00
`);
  process.exit(command === "help" ? 0 : 1);
}

const privateKey = process.env.ARCADE_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
if (!privateKey) {
  throw new Error("ARCADE_BUYER_PRIVATE_KEY is required. Run `wallet.ts create` or export an existing key.");
}

const client = new GatewayClient({
  chain,
  privateKey,
  rpcUrl: process.env.ARCADE_RPC_URL,
});

if (command === "address") {
  console.log(client.address);
}

if (command === "balances") {
  const balances = await client.getBalances();
  console.log(JSON.stringify(balances, bigintReplacer, 2));
}

if (command === "deposit") {
  if (!amount) {
    throw new Error("Usage: wallet.ts deposit <amount>");
  }
  const result = await client.deposit(amount);
  console.log(JSON.stringify(result, bigintReplacer, 2));
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
