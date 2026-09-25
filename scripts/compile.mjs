import fs from "node:fs";
import solc from "solc";

const source = fs.readFileSync("contracts/XPerksDemo.sol", "utf8");
const input = { language: "Solidity", sources: { "XPerksDemo.sol": { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors?.filter((e) => e.severity === "error") || [];
if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
const compiled = output.contracts["XPerksDemo.sol"].XPerksDemo;
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync("artifacts/XPerksDemo.json", JSON.stringify(compiled, null, 2));
console.log("Compiled XPerksDemo");
