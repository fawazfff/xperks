import fs from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
const xlayerTestnet = defineChain({ id: 1952, name: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: ["https://testrpc.xlayer.tech/terigon"] } }, blockExplorers: { default: { name: "OKX Explorer", url: "https://www.okx.com/web3/explorer/xlayer-test" } }, testnet: true });

const key = process.env.DEPLOYER_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("Set DEPLOYER_PRIVATE_KEY in your shell. Never commit it.");
const artifact = JSON.parse(fs.readFileSync("artifacts/XPerksDemo.json", "utf8"));
const rpc = process.env.XLAYER_RPC || "https://testrpc.xlayer.tech/terigon";
const account = privateKeyToAccount(key);
const publicClient = createPublicClient({ chain: xlayerTestnet, transport: http(rpc) });
const wallet = createWalletClient({ account, chain: xlayerTestnet, transport: http(rpc) });
const balance = await publicClient.getBalance({ address: account.address });
console.log(`Deployer: ${account.address}, test OKB: ${Number(balance) / 1e18}`);
if (!balance) throw new Error("Fund the deployer with free test OKB from https://web3.okx.com/xlayer/faucet");
const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` });
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error(`Deployment failed: ${hash}`);
console.log(`Contract: ${receipt.contractAddress}\nTransaction: ${hash}`);
