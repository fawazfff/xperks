import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const key = process.env.DEPLOYER_PRIVATE_KEY;
const contract = process.env.XPERKS_CONTRACT;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key) || !contract || !/^0x[0-9a-fA-F]{40}$/.test(contract)) {
  throw new Error("Set DEPLOYER_PRIVATE_KEY and XPERKS_CONTRACT in the shell.");
}

const chain = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } },
});
const transport = http(process.env.XLAYER_RPC || "https://testrpc.xlayer.tech/terigon");
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain, transport });
const wallet = createWalletClient({ account, chain, transport });

const abi = [
  { type: "function", name: "createBenefit", stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claimDemoAsset", stateMutability: "nonpayable", inputs: [{ type: "string" }], outputs: [] },
  { type: "function", name: "claimBenefit", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "benefitCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "hasClaimed", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
];

async function send(functionName, args) {
  const hash = await wallet.writeContract({ address: contract, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90000 });
  if (receipt.status !== "success") throw new Error(`${functionName} reverted: ${hash}`);
  console.log(`${functionName}: https://www.okx.com/web3/explorer/xlayer-test/tx/${hash}`);
}

await send("createBenefit", [
  "Tesla Holder Pack",
  "A private reward for wallets holding demo Tesla shares.",
  "dTSLA",
  parseUnits("0.01", 18),
]);
const id = await publicClient.readContract({ address: contract, abi, functionName: "benefitCount" });
await send("claimDemoAsset", ["dTSLA"]);
await send("claimBenefit", [id]);

const claimed = await publicClient.readContract({
  address: contract,
  abi,
  functionName: "hasClaimed",
  args: [id, account.address],
});
if (!claimed) throw new Error("Claim verification failed");
console.log(`Verified benefit ${id}, wallet ${account.address}`);
