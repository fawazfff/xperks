import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, ArrowSquareOut, CheckCircle, Copy, Gift, LinkSimple, Plus, ShieldCheck, SpinnerGap, Wallet } from "@phosphor-icons/react";
import { createPublicClient, createWalletClient, custom, formatUnits, http, isAddress, parseUnits, type Address, type EIP1193Provider, type Hash } from "viem";
import { xlayerMainnet, xlayerTestnet } from "./chain";
import "./styles.css";

const CONTRACT = (import.meta.env.VITE_XPERKS_CONTRACT || "0x56bdbf41ab0eb0fa450dbe3774504b09a034db05") as Address;
const RPC = import.meta.env.VITE_XLAYER_RPC || "https://testrpc.xlayer.tech/terigon";
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer-test";
const abi = [
  { type: "function", name: "benefitCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "receivedDemoShares", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "hasClaimed", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "getBenefit", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "creator", type: "address" }, { name: "title", type: "string" }, { name: "description", type: "string" }, { name: "reward", type: "string" }, { name: "minimum", type: "uint256" }, { name: "active", type: "bool" }] }] },
  { type: "function", name: "claimDemoShares", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimBenefit", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "createBenefit", stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "event", name: "BenefitCreated", inputs: [{ name: "id", type: "uint256", indexed: true }, { name: "creator", type: "address", indexed: true }, { name: "minimum", type: "uint256", indexed: false }] },
] as const;

type Benefit = { id: bigint; creator: Address; title: string; description: string; reward: string; minimum: bigint; active: boolean };
type WalletProvider = EIP1193Provider & { on?: (event: string, callback: (...args: unknown[]) => void) => void; removeListener?: (event: string, callback: (...args: unknown[]) => void) => void };
declare global { interface Window { ethereum?: WalletProvider } }
const client = createPublicClient({ chain: xlayerTestnet, transport: http(RPC) });
const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const amount = (value: bigint) => Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 3 });
const validContract = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT);
const REAL_TSLA = "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0" as Address;
const mainnetClient = createPublicClient({ chain: xlayerMainnet, transport: http("https://rpc.xlayer.tech") });

function RealStockCheck({ connected }: { connected: Address | null }) {
  const [wallet, setWallet] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [checkError, setCheckError] = useState("");
  async function check(event: React.FormEvent) {
    event.preventDefault(); setCheckError(""); setResult(null);
    const target = wallet.trim() || connected || "";
    if (!isAddress(target)) { setCheckError("Enter a valid EVM wallet address."); return; }
    setWorking(true);
    try {
      const value = await mainnetClient.readContract({ address: REAL_TSLA, abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "balanceOf", args: [target] });
      setResult(`${amount(value)} TSLAx`);
    } catch { setCheckError("Could not reach X Layer mainnet. Try again in a moment."); }
    finally { setWorking(false); }
  }
  return <section className="real-check"><div><p className="intro-tag">Real asset check</p><h2>See a real xStock balance.</h2><p>Enter a wallet to read its Tesla xStock balance directly from the TSLAx contract on X Layer mainnet. This check is read-only.</p><a href={`https://www.oklink.com/x-layer/evm/token/${REAL_TSLA}`} target="_blank" rel="noreferrer">View TSLAx contract <ArrowSquareOut size={15} /></a></div><form onSubmit={check}><label htmlFor="real-wallet">Wallet address</label><div><input id="real-wallet" placeholder={connected || "0x..."} value={wallet} onChange={(event) => setWallet(event.target.value)} /><button disabled={working}>{working ? "Checking…" : "Check balance"}</button></div>{result && <p className="check-result"><CheckCircle weight="fill" /> X Layer mainnet balance: <strong>{result}</strong></p>}{checkError && <p className="check-error" role="alert">{checkError}</p>}<small>Reading the balance is free. No wallet connection or transaction is required.</small></form></section>;
}

function App() {
  const [address, setAddress] = useState<Address | null>(null);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [selected, setSelected] = useState<Benefit | null>(null);
  const [balance, setBalance] = useState(0n);
  const [received, setReceived] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [view, setView] = useState<"explore" | "create">("explore");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Hash | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("Tesla Holder Pack");
  const [description, setDescription] = useState("A thank-you for people holding demo Tesla shares.");
  const [reward, setReward] = useState("Welcome to the Tesla Holder Pack. Your ownership has been verified on X Layer testnet.");
  const [minimum, setMinimum] = useState("0.01");

  async function loadBenefits() {
    if (!validContract) return;
    const count = await client.readContract({ address: CONTRACT, abi, functionName: "benefitCount" });
    const ids = Array.from({ length: Number(count > 12n ? 12n : count) }, (_, i) => count - BigInt(i));
    const rows = await Promise.all(ids.map(async (id) => ({ id, ...await client.readContract({ address: CONTRACT, abi, functionName: "getBenefit", args: [id] }) })));
    setBenefits(rows.filter((row) => row.active));
    const match = window.location.pathname.match(/^\/benefit\/(\d+)\/?$/);
    if (match) setSelected(rows.find((row) => row.id === BigInt(match[1])) || null);
  }

  async function loadWallet(nextAddress: Address, benefitId?: bigint) {
    if (!validContract) return;
    const [shares, gotShares] = await Promise.all([
      client.readContract({ address: CONTRACT, abi, functionName: "balanceOf", args: [nextAddress] }),
      client.readContract({ address: CONTRACT, abi, functionName: "receivedDemoShares", args: [nextAddress] }),
    ]);
    setBalance(shares);
    setReceived(gotShares);
    if (benefitId) setClaimed(await client.readContract({ address: CONTRACT, abi, functionName: "hasClaimed", args: [benefitId, nextAddress] }));
  }

  useEffect(() => {
    loadBenefits().catch(() => setError("Could not reach X Layer testnet. Try refreshing the page."));
    const provider = window.ethereum;
    if (!provider) return;
    provider.request({ method: "eth_accounts" }).then((accounts) => {
      const first = (accounts as Address[])?.[0];
      if (first) setAddress(first);
    }).catch(() => undefined);
    const onAccounts = (...args: unknown[]) => setAddress(((args[0] as Address[]) || [])[0] || null);
    provider.on?.("accountsChanged", onAccounts);
    return () => provider.removeListener?.("accountsChanged", onAccounts);
  }, []);

  useEffect(() => {
    if (address) loadWallet(address, selected?.id).catch(() => setError("Could not read this wallet on X Layer testnet."));
    else { setBalance(0n); setReceived(false); setClaimed(false); }
  }, [address, selected?.id]);

  function openBenefit(benefit: Benefit) {
    setSelected(benefit); setView("explore"); setError(""); setTx(null); setCopied(false);
    window.history.pushState({}, "", `/benefit/${benefit.id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function goHome() {
    setSelected(null); setView("explore"); setError(""); setTx(null); setCreatedLink("");
    window.history.pushState({}, "", "/");
  }
  useEffect(() => {
    const onPop = () => { const match = window.location.pathname.match(/^\/benefit\/(\d+)\/?$/); setSelected(match ? benefits.find((b) => b.id === BigInt(match[1])) || null : null); setView("explore"); };
    window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop);
  }, [benefits]);

  async function connect() {
    setError("");
    if (!window.ethereum) { setError("Open this page in an EVM wallet browser, such as MetaMask or OKX Wallet, to connect."); return; }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
      if (accounts[0]) setAddress(accounts[0]);
      await ensureChain();
    } catch (cause) { setError(errorText(cause)); }
  }
  async function ensureChain() {
    const provider = window.ethereum;
    if (!provider) throw new Error("No browser wallet found.");
    const chainId = await provider.request({ method: "eth_chainId" });
    if (chainId === "0x7a0") return;
    try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] }); }
    catch (cause) {
      if ((cause as { code?: number }).code !== 4902) throw cause;
      await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x7a0", chainName: "X Layer Testnet", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }] });
    }
  }
  async function write(functionName: "claimDemoShares" | "claimBenefit" | "createBenefit", args?: readonly [bigint] | readonly [string, string, string, bigint]) {
    setError(""); setTx(null); setBusy(functionName);
    try {
      if (!validContract) throw new Error("The X Layer demo contract has not been deployed yet.");
      if (!window.ethereum) throw new Error("Open this page in an EVM wallet browser to continue.");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
      const account = accounts[0];
      if (!account) throw new Error("Connect a wallet to continue.");
      setAddress(account);
      await ensureChain();
      const wallet = createWalletClient({ chain: xlayerTestnet, transport: custom(window.ethereum), account });
      let hash: Hash;
      if (functionName === "createBenefit") hash = await wallet.writeContract({ address: CONTRACT, abi, functionName, args: args as [string, string, string, bigint] });
      else if (functionName === "claimBenefit") hash = await wallet.writeContract({ address: CONTRACT, abi, functionName, args: args as [bigint] });
      else hash = await wallet.writeContract({ address: CONTRACT, abi, functionName });
      setTx(hash); setBusy("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90000 });
      if (receipt.status !== "success") throw new Error("The transaction failed. View it in the explorer for details.");
      if (functionName === "createBenefit") {
        await loadBenefits();
        const count = await client.readContract({ address: CONTRACT, abi, functionName: "benefitCount" });
        setCreatedLink(`${window.location.origin}/benefit/${count}`);
      } else {
        await loadWallet(account, selected?.id);
        await loadBenefits();
      }
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(""); }
  }
  async function copy(value: string) { await navigator.clipboard.writeText(value); setCopied(true); }
  const status = busy === "confirming" ? "Waiting for X Layer confirmation…" : busy ? "Approve in your wallet…" : "";

  return <div className="app-shell">
    <header className="site-header"><button className="brand" onClick={goHome} aria-label="xPerks home"><span className="brand-icon">✳</span> xPerks</button><nav><button onClick={goHome}>Explore</button><button onClick={() => { setSelected(null); setView("create"); setError(""); window.history.pushState({}, "", "/create"); }}>Create a benefit</button></nav><button className="wallet-button" onClick={connect}><Wallet size={18} /> {address ? short(address) : "Connect wallet"}</button></header>
    {!validContract && <div className="setup-banner">The X Layer contract is being connected. Creation and claims will be available after deployment.</div>}
    {selected ? <main className="detail-main"><button className="back-link" onClick={goHome}>← All benefits</button><div className="detail-grid"><article className="ticket detail-ticket"><div className="ticket-top"><span className="stock-mark">dTSLA</span><span className="testnet-pill">X Layer testnet</span></div><div className="ticket-content"><p className="mini-label">Holder benefit #{selected.id.toString()}</p><h1>{selected.title}</h1><p>{selected.description}</p></div><div className="ticket-bottom"><div><small>Hold at least</small><strong>{amount(selected.minimum)} dTSLA</strong></div><Gift size={30} /></div></article><section className="claim-panel"><span className="panel-icon"><ShieldCheck size={25} /></span><h2>Prove you hold it.</h2><p>Connect a wallet, collect free demo shares, then record your unlock on X Layer.</p><div className="balance-row"><span>Your demo shares</span><strong>{address ? `${amount(balance)} dTSLA` : "Connect to check"}</strong></div><div className="step-list"><div className="step"><span className="step-number">{received ? <CheckCircle weight="fill" /> : "1"}</span><div><strong>Get demo shares</strong><small>One free test share per wallet.</small></div><button onClick={() => write("claimDemoShares")} disabled={!!busy || received || !validContract}>{received ? "Received" : "Get shares"}</button></div><div className="step"><span className="step-number">{claimed ? <CheckCircle weight="fill" /> : "2"}</span><div><strong>Unlock the benefit</strong><small>Your balance is checked by the contract.</small></div><button onClick={() => write("claimBenefit", [selected.id])} disabled={!!busy || claimed || balance < selected.minimum || !validContract}>{claimed ? "Unlocked" : "Unlock"}</button></div></div>{!received && <p className="gas-help">You need free test OKB for the two transactions. <a href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">Get it from the X Layer faucet <ArrowSquareOut size={13} /></a></p>}{claimed && <div className="reward-box"><span><CheckCircle weight="fill" /> Ownership verified</span><h3>Access unlocked</h3><p>{selected.reward}</p><small>Demo reward content is public onchain. Do not use private codes or links.</small></div>}</section></div><div className="proof-row"><span>Contract: <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">{validContract ? short(CONTRACT) : "Pending deployment"}</a></span><button onClick={() => copy(window.location.href)}><Copy size={15} /> {copied ? "Copied" : "Copy benefit link"}</button></div></main> : view === "create" ? <main className="create-main"><button className="back-link" onClick={goHome}>← Explore benefits</button><div className="create-grid"><div><p className="intro-tag">For creators</p><h1>Give holders a reason to stay.</h1><p className="lead">Publish an ownership rule, share the page, and let visitors prove eligibility from their wallet.</p><div className="note-card"><ShieldCheck size={23} /><div><strong>A real testnet transaction</strong><p>Your rule is stored in the X Layer demo contract. You will need free test OKB to publish.</p><a href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">Open faucet <ArrowSquareOut size={14} /></a></div></div></div><form className="create-form" onSubmit={(event) => { event.preventDefault(); try { const value = parseUnits(minimum, 18); if (value <= 0n || value > parseUnits("1", 18)) throw new Error("Choose an amount above 0 and no more than 1 dTSLA."); void write("createBenefit", [title.trim(), description.trim(), reward.trim(), value]); } catch (cause) { setError(errorText(cause)); } }}><label>Benefit name<input required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label><label>What does the holder get?<textarea required maxLength={320} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label><div className="form-row"><label>Required asset<div className="fixed-input">dTSLA <small>Demo stock</small></div></label><label>Minimum balance<input required type="number" min="0.000001" max="1" step="any" value={minimum} onChange={(e) => setMinimum(e.target.value)} /></label></div><label>Reward message<textarea required maxLength={500} rows={3} value={reward} onChange={(e) => setReward(e.target.value)} /><small>This message is stored publicly onchain. Do not enter a private URL or access code.</small></label><button className="primary wide" type="submit" disabled={!!busy || !validContract}>{status ? <SpinnerGap className="spin" size={19} /> : <Plus size={18} />} {status || "Publish benefit"}</button>{createdLink && <div className="created-box"><CheckCircle weight="fill" /><div><strong>Benefit published</strong><p><a href={createdLink}>{createdLink}</a></p><button type="button" onClick={() => copy(createdLink)}>{copied ? "Copied" : "Copy link"}</button></div></div>}</form></div></main> : <main><section className="hero"><div className="hero-copy"><p className="intro-tag"><span className="live-dot" /> Built on X Layer testnet</p><h1>Make ownership<br />worth holding.</h1><p>Turn tokenized stock ownership into something people can use. Create a benefit, share it, and let a wallet prove who qualifies.</p><div className="hero-actions"><button className="primary" onClick={() => { setView("create"); window.history.pushState({}, "", "/create"); }}>Create a benefit <ArrowRight size={19} /></button><a href="#benefits" className="secondary">Try the demo <span>↓</span></a></div><div className="hero-foot"><span><CheckCircle size={18} /> No shares leave your wallet</span><span><CheckCircle size={18} /> Free testnet demo</span></div></div><div className="hero-art" aria-label="Example holder benefit"><div className="float-note">Your wallet qualifies <CheckCircle weight="fill" /></div><div className="ticket hero-ticket"><div className="ticket-top"><span className="stock-mark">dTSLA</span><span className="testnet-pill">X Layer testnet</span></div><div className="ticket-content"><p className="mini-label">Ownership has its perks</p><h2>Tesla Holder Pack</h2><p>A little more from what you hold.</p></div><div className="ticket-bottom"><div><small>To unlock</small><strong>Hold 0.01 dTSLA</strong></div><Gift size={31} /></div></div><div className="float-caption">01 / Connect wallet<br />02 / Verify balance<br />03 / Unlock benefit</div></div></section><section className="benefits-section" id="benefits"><div className="section-head"><div><p className="intro-tag">Live demo</p><h2>Try a holder benefit.</h2><p>Use free demo shares. These are test assets, not real stocks.</p></div><a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="explorer-link">View the contract <ArrowSquareOut size={17} /></a></div><div className="benefit-list">{benefits.length ? benefits.map((benefit) => <button className="benefit-row" key={benefit.id.toString()} onClick={() => openBenefit(benefit)}><span className="row-symbol">dTSLA</span><span className="row-text"><strong>{benefit.title}</strong><small>{benefit.description}</small></span><span className="row-min">Hold {amount(benefit.minimum)} dTSLA</span><ArrowRight size={21} /></button>) : <div className="empty-benefits"><Gift size={29} /><strong>{validContract ? "No benefits published yet." : "Demo contract pending deployment."}</strong><p>Create the first benefit to start the live flow.</p></div>}</div></section><RealStockCheck connected={address} /><section className="how-section"><h2>From holding to access.</h2><div><p><b>01</b> A creator sets a minimum share balance.</p><p><b>02</b> A visitor connects and collects free demo shares.</p><p><b>03</b> X Layer checks the balance and records the unlock.</p></div></section></main>}
    {status && view !== "create" && <div className="busy-toast"><SpinnerGap className="spin" size={18} />{status}</div>}
    {tx && <div className="tx-toast"><span>Transaction on X Layer</span><a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer">View receipt <ArrowSquareOut size={14} /></a></div>}
    {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    <footer><span><span className="brand-icon">✳</span> xPerks</span><p>A testnet prototype for OKX Dev Day 2026. Demo shares have no value and are not official tokenized stocks.</p><a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">X Layer explorer <ArrowSquareOut size={14} /></a></footer>
  </div>;
}

function errorText(cause: unknown) {
  const error = cause as { shortMessage?: string; message?: string; code?: number };
  if (error?.code === 4001) return "Wallet request rejected. You can try again when ready.";
  const message = error?.shortMessage || error?.message || "Something went wrong. Try again.";
  if (/insufficient funds/i.test(message)) return "This wallet needs free test OKB for gas. Use the X Layer faucet and try again.";
  return message.split("\n")[0].slice(0, 240);
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
