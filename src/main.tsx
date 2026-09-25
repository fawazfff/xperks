import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  Copy,
  Gift,
  Plus,
  ShieldCheck,
  SpinnerGap,
  Wallet,
} from "@phosphor-icons/react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  stringToHex,
  type Abi,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import artifact from "../artifacts/XPerksDemo.json";
import { xlayerTestnet } from "./chain";
import {
  createCampaign,
  getActiveContract,
  getCampaign,
  getDashboard,
  listCampaigns,
  unlockCampaign,
  updateCampaignDestination,
  type Campaign,
} from "./supabase";
import "./styles.css";
import "./redesign.css";
import "./polish.css";

const RPC = import.meta.env.VITE_XLAYER_RPC || "https://testrpc.xlayer.tech/terigon";
const EXPLORER = "https://www.okx.com/web3/explorer/xlayer-test";
const client = createPublicClient({ chain: xlayerTestnet, transport: http(RPC) });

const abi = [
  { type: "function", name: "benefitCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getBenefit",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "creator", type: "address" },
        { name: "title", type: "string" },
        { name: "description", type: "string" },
        { name: "asset", type: "string" },
        { name: "minimum", type: "uint256" },
        { name: "active", type: "bool" },
      ],
    }],
  },
  { type: "function", name: "balanceOfAsset", stateMutability: "view", inputs: [{ type: "string" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "receivedDemoAsset", stateMutability: "view", inputs: [{ type: "string" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "hasClaimed", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "isSupportedAsset", stateMutability: "pure", inputs: [{ type: "string" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "claimDemoAsset", stateMutability: "nonpayable", inputs: [{ type: "string" }], outputs: [] },
  { type: "function", name: "claimBenefit", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  { type: "function", name: "createBenefit", stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "event",
    name: "BenefitCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "asset", type: "string", indexed: false },
      { name: "minimum", type: "uint256", indexed: false },
    ],
  },
] as const;

type Benefit = {
  creator: Address;
  title: string;
  description: string;
  asset: string;
  minimum: bigint;
  active: boolean;
};

type WalletProvider = EIP1193Provider & {
  on?: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

const DEMO_ASSETS = [
  { symbol: "dTSLA", ticker: "TSLA", name: "Tesla" },
  { symbol: "dNVDA", ticker: "NVDA", name: "NVIDIA" },
  { symbol: "dAAPL", ticker: "AAPL", name: "Apple" },
  { symbol: "dCOIN", ticker: "COIN", name: "Coinbase" },
  { symbol: "dMSFT", ticker: "MSFT", name: "Microsoft" },
  { symbol: "dAMZN", ticker: "AMZN", name: "Amazon" },
  { symbol: "dMSTR", ticker: "MSTR", name: "Strategy" },
] as const;

type View = "home" | "explore" | "create" | "how" | "faq" | "faucet" | "dashboard";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const formatAmount = (value: bigint) => Number(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 });
const bytecode = `0x${artifact.evm.bytecode.object}` as `0x${string}`;
const compiledAbi = artifact.abi as Abi;

function viewForPath(path: string): View {
  if (path === "/create") return "create";
  if (path === "/explore") return "explore";
  if (path === "/how-it-works") return "how";
  if (path === "/faq") return "faq";
  if (path === "/demo-stocks") return "faucet";
  if (path === "/dashboard") return "dashboard";
  return "home";
}

function App() {
  const [address, setAddress] = useState<Address | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [benefit, setBenefit] = useState<Benefit | null>(null);
  const [view, setView] = useState<View>(viewForPath(window.location.pathname));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tx, setTx] = useState<Hash | null>(null);
  const [createdLink, setCreatedLink] = useState("");
  const [unlockedUrl, setUnlockedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState(0n);
  const [received, setReceived] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [activeContract, setActiveContract] = useState<Address | null>(null);
  const [faucetAsset, setFaucetAsset] = useState("dTSLA");
  const [faucetContract, setFaucetContract] = useState<Address | null>(null);
  const [dashboardCampaigns, setDashboardCampaigns] = useState<Campaign[]>([]);

  const [title, setTitle] = useState("Tesla Holder Pack");
  const [description, setDescription] = useState("A private reward for wallets holding demo Tesla shares.");
  const [destination, setDestination] = useState("https://t.me/xperks");
  const [asset, setAsset] = useState("dTSLA");
  const [minimum, setMinimum] = useState("0.01");

  const currentContract = selected?.contract_address || faucetContract || activeContract;

  async function refreshCampaigns() {
    const rows = await listCampaigns();
    setCampaigns(rows);
    const live = await getActiveContract().catch(() => null);
    if (live && isAddress(live)) setActiveContract(live);
  }

  async function loadCampaignRoute(path = window.location.pathname) {
    const match = path.match(/^\/c\/(\d+)\/?$/);
    if (!match) {
      setSelected(null);
      setBenefit(null);
      return false;
    }
    const row = await getCampaign(Number(match[1]));
    setSelected(row);
    const onchain = await client.readContract({
      address: row.contract_address,
      abi,
      functionName: "getBenefit",
      args: [BigInt(row.onchain_benefit_id)],
    });
    setBenefit(onchain as Benefit);
    return true;
  }

  async function readWalletState(account: Address, campaign = selected) {
    if (!campaign) return;
    const contract = campaign.contract_address;
    const [nextBalance, nextReceived, nextClaimed] = await Promise.all([
      client.readContract({ address: contract, abi, functionName: "balanceOfAsset", args: [campaign.asset_symbol, account] }),
      client.readContract({ address: contract, abi, functionName: "receivedDemoAsset", args: [campaign.asset_symbol, account] }),
      client.readContract({ address: contract, abi, functionName: "hasClaimed", args: [BigInt(campaign.onchain_benefit_id), account] }),
    ]);
    setBalance(nextBalance);
    setReceived(nextReceived);
    setClaimed(nextClaimed);
  }

  useEffect(() => {
    refreshCampaigns().catch(() => setError("Could not load xPerks campaigns. Try refreshing."));
    loadCampaignRoute().catch(() => setError("This campaign could not be loaded."));

    const params = new URLSearchParams(window.location.search);
    const contract = params.get("contract");
    const requestedAsset = params.get("asset");
    if (contract && isAddress(contract)) setFaucetContract(contract);
    if (requestedAsset && DEMO_ASSETS.some((item) => item.symbol === requestedAsset)) setFaucetAsset(requestedAsset);

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
    if (address && selected) readWalletState(address, selected).catch(() => setError("Could not read this wallet on X Layer testnet."));
    if (!address) {
      setBalance(0n);
      setReceived(false);
      setClaimed(false);
    }
  }, [address, selected?.id]);

  useEffect(() => {
    const onPop = () => {
      setView(viewForPath(window.location.pathname));
      loadCampaignRoute().catch(() => setError("This campaign could not be loaded."));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function ensureChain() {
    const provider = window.ethereum;
    if (!provider) throw new Error("No browser wallet found.");
    const chainId = await provider.request({ method: "eth_chainId" });
    if (typeof chainId === "string" && Number.parseInt(chainId, 16) === 1952) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
    } catch (cause) {
      const walletError = cause as { code?: number; message?: string; data?: { originalError?: { code?: number; message?: string } } };
      const code = walletError.code ?? walletError.data?.originalError?.code;
      const message = `${walletError.message || ""} ${walletError.data?.originalError?.message || ""}`;
      if (code !== 4902 && code !== -32603 && !/unrecognized|unknown chain|not added/i.test(message)) throw cause;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x7a0",
          chainName: "X Layer Testnet",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: [RPC],
          blockExplorerUrls: [EXPLORER],
        }],
      });
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
    }
  }

  async function getAccount() {
    if (!window.ethereum) throw new Error("Open xPerks in MetaMask, OKX Wallet, or another EVM wallet browser.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as Address[];
    const account = accounts[0];
    if (!account) throw new Error("Connect a wallet to continue.");
    setAddress(account);
    await ensureChain();
    return account;
  }

  async function connect() {
    setError("");
    try {
      await getAccount();
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function signedPayload(action: string, resource: string, account: Address) {
    if (!window.ethereum) throw new Error("No browser wallet found.");
    const issuedAt = Math.floor(Date.now() / 60_000);
    const message = `xPerks wallet proof\nAction: ${action}\nWallet: ${account.toLowerCase()}\nResource: ${resource}\nIssued minute: ${issuedAt}`;
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [stringToHex(message), account],
    }) as string;
    return { wallet: account, issuedAt, signature };
  }

  function navigate(next: View, path: string) {
    setSelected(null);
    setBenefit(null);
    setView(next);
    setError("");
    setTx(null);
    setCreatedLink("");
    setUnlockedUrl("");
    const target = new URL(path, window.location.origin);
    const contract = target.searchParams.get("contract");
    const requestedAsset = target.searchParams.get("asset");
    if (contract && isAddress(contract)) setFaucetContract(contract);
    if (requestedAsset && DEMO_ASSETS.some((item) => item.symbol === requestedAsset)) setFaucetAsset(requestedAsset);
    window.history.pushState({}, "", target.pathname + target.search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCampaign(campaign: Campaign) {
    setSelected(campaign);
    setBenefit(null);
    setView("home");
    setError("");
    setTx(null);
    setUnlockedUrl("");
    window.history.pushState({}, "", `/c/${campaign.id}`);
    client.readContract({
      address: campaign.contract_address,
      abi,
      functionName: "getBenefit",
      args: [BigInt(campaign.onchain_benefit_id)],
    }).then((row) => setBenefit(row as Benefit)).catch(() => setError("Could not read this campaign on X Layer."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goHome() {
    navigate("home", "/");
  }

  async function writeCampaignAction(functionName: "claimDemoAsset" | "claimBenefit", args: readonly [string] | readonly [bigint]) {
    if (!selected) return;
    setError("");
    setTx(null);
    setBusy(functionName);
    try {
      const account = await getAccount();
      if (!window.ethereum) throw new Error("No wallet found.");
      const wallet = createWalletClient({ chain: xlayerTestnet, transport: custom(window.ethereum), account });
      const hash = functionName === "claimDemoAsset"
        ? await wallet.writeContract({ address: selected.contract_address, abi, functionName, args: args as [string] })
        : await wallet.writeContract({ address: selected.contract_address, abi, functionName, args: args as [bigint] });
      setTx(hash);
      setBusy("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
      if (receipt.status !== "success") throw new Error("The X Layer transaction failed.");
      await readWalletState(account, selected);
      if (functionName === "claimBenefit") await revealAccess(account, selected);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function revealAccess(account = address, campaign = selected) {
    if (!account || !campaign) return;
    setBusy("unlock");
    setError("");
    try {
      await ensureChain();
      const proof = await signedPayload("unlock", String(campaign.id), account);
      const result = await unlockCampaign({ campaignId: campaign.id, ...proof });
      setUnlockedUrl(result.destination);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function deployV2(account: Address) {
    if (!window.ethereum) throw new Error("No wallet found.");
    const wallet = createWalletClient({ chain: xlayerTestnet, transport: custom(window.ethereum), account });
    setBusy("deploy");
    const hash = await wallet.deployContract({ abi: compiledAbi, bytecode });
    setTx(hash);
    setBusy("confirming");
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
    if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("The demo contract deployment failed.");
    setActiveContract(receipt.contractAddress);
    return receipt.contractAddress;
  }

  async function resolveDemoContract(account: Address) {
    const candidate = activeContract || await getActiveContract().catch(() => null);
    if (candidate && isAddress(candidate)) {
      const supported = await client.readContract({
        address: candidate,
        abi,
        functionName: "isSupportedAsset",
        args: [asset],
      }).catch(() => false);
      if (supported) return candidate;
    }
    return deployV2(account);
  }

  async function publishCampaign(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setTx(null);
    setCreatedLink("");
    setBusy("prepare");
    try {
      const target = new URL(destination.trim());
      if (target.protocol !== "https:") throw new Error("Use a secure HTTPS destination.");
      const minimumValue = parseUnits(minimum, 18);
      if (minimumValue <= 0n || minimumValue > parseUnits("1", 18)) throw new Error("Choose an amount above 0 and no more than 1 demo share.");

      const account = await getAccount();
      const contract = await resolveDemoContract(account);
      if (!window.ethereum) throw new Error("No wallet found.");
      const wallet = createWalletClient({ chain: xlayerTestnet, transport: custom(window.ethereum), account });

      setBusy("createBenefit");
      const hash = await wallet.writeContract({
        address: contract,
        abi,
        functionName: "createBenefit",
        args: [title.trim(), description.trim(), asset, minimumValue],
      });
      setTx(hash);
      setBusy("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
      if (receipt.status !== "success") throw new Error("The campaign transaction failed.");

      let benefitId: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== contract.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
          if (decoded.eventName === "BenefitCreated") {
            benefitId = (decoded.args as { id: bigint }).id;
            break;
          }
        } catch {
          // Ignore unrelated logs.
        }
      }
      if (!benefitId) throw new Error("The campaign was created, but its ID could not be read.");

      const proof = await signedPayload("create", `${contract.toLowerCase()}:${benefitId}`, account);
      const result = await createCampaign({
        contract,
        benefitId: Number(benefitId),
        destination: destination.trim(),
        txHash: hash,
        ...proof,
      });
      const link = `${window.location.origin}${result.path}`;
      setCreatedLink(link);
      setActiveContract(contract);
      await refreshCampaigns();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function claimFromFaucet(symbol: string) {
    setError("");
    setTx(null);
    setBusy(`faucet-${symbol}`);
    try {
      const account = await getAccount();
      const contract = faucetContract || activeContract || await getActiveContract();
      if (!contract || !isAddress(contract)) throw new Error("Create a campaign first so the demo-stock faucet knows which test contract to use.");
      setFaucetContract(contract);
      if (!window.ethereum) throw new Error("No wallet found.");
      const wallet = createWalletClient({ chain: xlayerTestnet, transport: custom(window.ethereum), account });
      const already = await client.readContract({ address: contract, abi, functionName: "receivedDemoAsset", args: [symbol, account] }).catch(() => false);
      if (already) throw new Error(`This wallet already received its free ${symbol} demo share from this test contract.`);
      const hash = await wallet.writeContract({ address: contract, abi, functionName: "claimDemoAsset", args: [symbol] });
      setTx(hash);
      setBusy("confirming");
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
      if (receipt.status !== "success") throw new Error("The demo-stock transaction failed.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function openDashboard() {
    setError("");
    setBusy("dashboard");
    try {
      const account = await getAccount();
      const proof = await signedPayload("dashboard", "dashboard", account);
      setDashboardCampaigns(await getDashboard(proof));
      navigate("dashboard", "/dashboard");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function changeDestination(campaign: Campaign) {
    const next = window.prompt("New private HTTPS destination");
    if (!next) return;
    setBusy("manage");
    setError("");
    try {
      const parsed = new URL(next);
      if (parsed.protocol !== "https:") throw new Error("Use a secure HTTPS destination.");
      const account = await getAccount();
      const proof = await signedPayload("manage", String(campaign.id), account);
      await updateCampaignDestination(campaign.id, { destination: next, ...proof });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const status = busy === "confirming"
    ? "Waiting for X Layer confirmation…"
    : busy === "deploy"
      ? "Approve the one-time demo contract deployment…"
      : busy
        ? "Approve in your wallet…"
        : "";

  return <div className="app-shell">
    <header className="site-header">
      <button className="brand" onClick={goHome} aria-label="xPerks home">
        <img src="/logo.svg" alt="" /> <span>xPerks</span>
      </button>
      <nav>
        <button onClick={() => navigate("explore", "/explore")}>Explore</button>
        <button onClick={() => navigate("faucet", "/demo-stocks")}>Demo stocks</button>
        <button onClick={() => navigate("how", "/how-it-works")}>How it works</button>
        <button onClick={() => navigate("faq", "/faq")}>FAQ</button>
      </nav>
      <div className="header-actions">
        {address && <button className="header-create ghost" onClick={openDashboard}>Dashboard</button>}
        <button className="header-create" onClick={() => navigate("create", "/create")}>Create perk</button>
        <button className="wallet-button" onClick={connect}><Wallet size={18} /> {address ? short(address) : "Connect"}</button>
      </div>
    </header>

    {selected ? <CampaignDetail
      campaign={selected}
      benefit={benefit}
      address={address}
      balance={balance}
      received={received}
      claimed={claimed}
      unlockedUrl={unlockedUrl}
      busy={busy}
      connect={connect}
      collect={() => writeCampaignAction("claimDemoAsset", [selected.asset_symbol])}
      verify={() => writeCampaignAction("claimBenefit", [BigInt(selected.onchain_benefit_id)])}
      reveal={() => revealAccess()}
      faucet={() => navigate("faucet", `/demo-stocks?contract=${selected.contract_address}&asset=${selected.asset_symbol}`)}
      back={() => navigate("explore", "/explore")}
      copy={() => copy(window.location.href)}
      copied={copied}
    /> : view === "create" ? <CreatePage
      title={title}
      setTitle={setTitle}
      description={description}
      setDescription={setDescription}
      asset={asset}
      setAsset={setAsset}
      minimum={minimum}
      setMinimum={setMinimum}
      destination={destination}
      setDestination={setDestination}
      submit={publishCampaign}
      busy={busy}
      status={status}
      createdLink={createdLink}
      copied={copied}
      copy={copy}
      back={goHome}
    /> : view === "explore" ? <ExplorePage campaigns={campaigns} openCampaign={openCampaign} create={() => navigate("create", "/create")} />
      : view === "faucet" ? <FaucetPage contract={currentContract} selectedAsset={faucetAsset} setSelectedAsset={setFaucetAsset} claim={claimFromFaucet} busy={busy} connect={connect} address={address} />
      : view === "dashboard" ? <DashboardPage campaigns={dashboardCampaigns} edit={changeDestination} copy={copy} />
      : view === "how" ? <HowPage create={() => navigate("create", "/create")} faucet={() => navigate("faucet", "/demo-stocks")} />
      : view === "faq" ? <FaqPage />
      : <HomePage campaigns={campaigns} openCampaign={openCampaign} create={() => navigate("create", "/create")} faucet={() => navigate("faucet", "/demo-stocks")} />}

    {status && view !== "create" && <div className="busy-toast"><SpinnerGap className="spin" size={18} />{status}</div>}
    {tx && <div className="tx-toast"><span>Transaction on X Layer</span><a href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer">View receipt <ArrowSquareOut size={14} /></a></div>}
    {error && <div className="error-toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}

    <footer>
      <span><img className="footer-logo" src="/logo.svg" alt="" /> xPerks</span>
      <p>Testnet demo shares have no financial value and are not real stocks or official tokenized equities.</p>
      <a href={EXPLORER} target="_blank" rel="noreferrer">X Layer explorer <ArrowSquareOut size={14} /></a>
    </footer>
  </div>;
}

function CampaignDetail(props: {
  campaign: Campaign;
  benefit: Benefit | null;
  address: Address | null;
  balance: bigint;
  received: boolean;
  claimed: boolean;
  unlockedUrl: string;
  busy: string;
  connect: () => void;
  collect: () => void;
  verify: () => void;
  reveal: () => void;
  faucet: () => void;
  back: () => void;
  copy: () => void;
  copied: boolean;
}) {
  const { campaign, benefit, address, balance, received, claimed, unlockedUrl, busy } = props;
  const enough = benefit ? balance >= benefit.minimum : Number(formatUnits(balance, 18)) >= Number(campaign.minimum_display);
  return <main className="detail-main">
    <button className="back-link" onClick={props.back}>← Explore perks</button>
    <div className="detail-grid">
      <article className="ticket detail-ticket">
        <div className="ticket-top"><span className="stock-mark">{campaign.asset_symbol}</span><span className="testnet-pill">X Layer testnet</span></div>
        <div className="ticket-content">
          <p className="mini-label">Campaign /c/{campaign.id}</p>
          <h1>{campaign.title}</h1>
          <p>{campaign.description}</p>
        </div>
        <div className="ticket-bottom">
          <div><small>Hold at least</small><strong>{campaign.minimum_display} {campaign.asset_symbol}</strong></div>
          <Gift size={30} />
        </div>
      </article>

      <section className="claim-panel">
        <div className="access-heading"><span className="panel-icon"><ShieldCheck size={25} /></span><span>Wallet ownership check</span></div>
        <h2>{claimed ? "You qualify." : "Your wallet is the key."}</h2>
        <p>{claimed ? "This wallet passed the campaign rule on X Layer testnet." : `xPerks checks whether this exact wallet holds the required ${campaign.asset_symbol} demo stock. Other demo stocks do not count.`}</p>
        <div className="wallet-snapshot">
          <div><small>Connected wallet</small><strong>{address ? short(address) : "Not connected"}</strong></div>
          <div><small>{campaign.asset_symbol} balance</small><strong>{address ? `${formatAmount(balance)} ${campaign.asset_symbol}` : "—"}</strong></div>
        </div>

        {!address ? <button className="access-action" onClick={props.connect}><Wallet size={19} /> Connect wallet</button>
          : !received ? <>
            <button className="access-action" onClick={props.collect} disabled={!!busy}>Get free demo {campaign.asset_symbol}</button>
            <button className="faucet-link" onClick={props.faucet}>Open the demo-stock faucet instead →</button>
          </>
          : !claimed ? <button className="access-action" onClick={props.verify} disabled={!!busy || !enough}><ShieldCheck size={19} /> Verify ownership</button>
          : unlockedUrl ? <a className="access-action unlocked" href={unlockedUrl} target="_blank" rel="noreferrer">Open your private perk <ArrowSquareOut size={18} /></a>
          : <button className="access-action unlocked" onClick={props.reveal} disabled={!!busy}>Reveal my access</button>}

        {address && !received && <p className="gas-help">Demo stocks are free, but the test transaction needs free test OKB. <a href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">Get test OKB <ArrowSquareOut size={13} /></a></p>}
        {claimed && <div className="verified-line"><CheckCircle weight="fill" /> Verified on X Layer</div>}
      </section>
    </div>
    <div className="proof-row">
      <span>Contract: <a href={`${EXPLORER}/address/${campaign.contract_address}`} target="_blank" rel="noreferrer">{short(campaign.contract_address)}</a></span>
      <button onClick={props.copy}><Copy size={15} /> {props.copied ? "Copied" : "Copy campaign link"}</button>
    </div>
  </main>;
}

function CreatePage(props: {
  title: string; setTitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  asset: string; setAsset: (v: string) => void;
  minimum: string; setMinimum: (v: string) => void;
  destination: string; setDestination: (v: string) => void;
  submit: (event: React.FormEvent) => void;
  busy: string; status: string; createdLink: string; copied: boolean;
  copy: (value: string) => void; back: () => void;
}) {
  return <main className="create-main">
    <button className="back-link" onClick={props.back}>← Explore perks</button>
    <div className="create-grid">
      <div>
        <p className="intro-tag">For creators</p>
        <h1>Create one link for one ownership rule.</h1>
        <p className="lead">Choose a stock, set the minimum, add a private destination, then share the permanent campaign URL.</p>
        <div className="note-card"><ShieldCheck size={23} /><div><strong>Creator-owned campaign</strong><p>Your wallet is recorded as the creator. Another wallet cannot edit your private destination just by guessing the campaign number.</p><a href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">Get free test OKB <ArrowSquareOut size={14} /></a></div></div>
      </div>
      <form className="create-form" onSubmit={props.submit}>
        <label>Campaign name<input required minLength={3} maxLength={80} value={props.title} onChange={(e) => props.setTitle(e.target.value)} /></label>
        <label>What does the holder get?<textarea required maxLength={320} rows={2} value={props.description} onChange={(e) => props.setDescription(e.target.value)} /></label>
        <div className="form-row">
          <label>Required demo stock<select value={props.asset} onChange={(e) => props.setAsset(e.target.value)}>{DEMO_ASSETS.map((item) => <option value={item.symbol} key={item.symbol}>{item.name} ({item.ticker}) · {item.symbol}</option>)}</select></label>
          <label>Minimum balance<input required type="number" min="0.000001" max="1" step="any" value={props.minimum} onChange={(e) => props.setMinimum(e.target.value)} /></label>
        </div>
        <label>Private destination<input required type="url" maxLength={1200} placeholder="https://t.me/your-group" value={props.destination} onChange={(e) => props.setDestination(e.target.value)} /><small>Only a wallet that passes the ownership check can ask xPerks to reveal this URL.</small></label>
        <button className="primary wide" type="submit" disabled={!!props.busy}>{props.status ? <SpinnerGap className="spin" size={19} /> : <Plus size={18} />} {props.status || "Publish campaign"}</button>
        {props.createdLink && <div className="created-box"><CheckCircle weight="fill" /><div><strong>Campaign published</strong><p><a href={props.createdLink}>{props.createdLink}</a></p><button type="button" onClick={() => props.copy(props.createdLink)}>{props.copied ? "Copied" : "Copy link"}</button></div></div>}
      </form>
    </div>
  </main>;
}

function HomePage({ campaigns, openCampaign, create, faucet }: { campaigns: Campaign[]; openCampaign: (c: Campaign) => void; create: () => void; faucet: () => void }) {
  const example = campaigns[0];
  return <main>
    <section className="hero">
      <div className="hero-copy">
        <p className="intro-tag"><span className="live-dot" /> Built on X Layer testnet</p>
        <h1>Stocks that<br />unlock something.</h1>
        <p>Create a perk for holders, share one campaign link, and let the wallet prove whether it owns the required demo stock.</p>
        <div className="hero-actions"><button className="primary" onClick={create}>Create a campaign <ArrowRight size={19} /></button><button className="secondary button-link" onClick={faucet}>Get demo stocks <span>→</span></button></div>
        <div className="hero-foot"><span><CheckCircle size={18} /> Wallet-specific checks</span><span><CheckCircle size={18} /> Seven demo stocks</span><span><CheckCircle size={18} /> Private perk delivery</span></div>
      </div>
      <div className="hero-art" aria-label="Example stock holder perk">
        <div className="float-note">Wallet qualifies <CheckCircle weight="fill" /></div>
        <div className="ticket hero-ticket">
          <div className="ticket-top"><span className="stock-mark">{example?.asset_symbol || "dTSLA"}</span><span className="testnet-pill">X Layer testnet</span></div>
          <div className="ticket-content"><p className="mini-label">Ownership has its perks</p><h2>{example?.title || "Tesla Holder Pack"}</h2><p>{example?.description || "A private reward unlocked by a wallet balance."}</p></div>
          <div className="ticket-bottom"><div><small>To unlock</small><strong>Hold {example?.minimum_display || 0.01} {example?.asset_symbol || "dTSLA"}</strong></div><Gift size={31} /></div>
        </div>
        <div className="float-caption">Campaign links look like /c/18.<br />The creator wallet owns the settings.</div>
      </div>
    </section>

    <section className="benefits-section" id="benefits">
      <div className="section-head"><div><p className="intro-tag">Live campaigns</p><h2>Try the ownership check.</h2><p>Get a free demo stock first, then come back and verify the same wallet.</p></div><button className="explorer-link plain-button" onClick={faucet}>Open demo-stock faucet <ArrowRight size={17} /></button></div>
      <div className="benefit-list">{campaigns.length ? campaigns.slice(0, 8).map((campaign) => <button className="benefit-row" key={campaign.id} onClick={() => openCampaign(campaign)}><span className="row-symbol">{campaign.asset_symbol}</span><span className="row-text"><strong>{campaign.title}</strong><small>{campaign.description}</small></span><span className="row-min">Hold {campaign.minimum_display} {campaign.asset_symbol}</span><ArrowRight size={21} /></button>) : <div className="empty-benefits"><Gift size={29} /><strong>No V2 campaigns yet.</strong><p>Create the first one. xPerks will deploy the multi-stock test contract from your wallet.</p></div>}</div>
    </section>

    <section className="how-section"><h2>From demo stock to private access.</h2><div><p><b>01</b> Get one free demo stock on X Layer testnet.</p><p><b>02</b> Open a campaign link and connect the same wallet.</p><p><b>03</b> xPerks checks that exact asset balance and opens the private destination only after verification.</p></div></section>
  </main>;
}

function ExplorePage({ campaigns, openCampaign, create }: { campaigns: Campaign[]; openCampaign: (campaign: Campaign) => void; create: () => void }) {
  return <main className="page-shell"><section className="page-hero"><p className="intro-tag">Explore xPerks</p><h1>One campaign.<br />One stock rule.</h1><p>Each campaign has a permanent numeric link, an X Layer ownership rule, and a creator wallet that controls the private destination.</p><button className="primary" onClick={create}>Create a campaign <ArrowRight size={18} /></button></section><section className="perk-grid">{campaigns.map((campaign, index) => <button className="perk-card" key={campaign.id} onClick={() => openCampaign(campaign)}><span className="perk-index">/c/{campaign.id}</span><div className="perk-symbol">{campaign.asset_symbol}</div><div><p>Verified holder access</p><h2>{campaign.title}</h2><span>{campaign.description}</span></div><footer><strong>Hold {campaign.minimum_display} {campaign.asset_symbol}</strong><ArrowRight size={20} /></footer></button>)}</section>{!campaigns.length && <div className="empty-state-large"><Gift size={35} /><h2>No campaigns yet.</h2><p>Publish the first multi-stock xPerks campaign.</p></div>}</main>;
}

function FaucetPage({ contract, selectedAsset, setSelectedAsset, claim, busy, connect, address }: {
  contract: Address | null;
  selectedAsset: string;
  setSelectedAsset: (value: string) => void;
  claim: (asset: string) => void;
  busy: string;
  connect: () => void;
  address: Address | null;
}) {
  return <main className="page-shell">
    <section className="page-hero narrow"><p className="intro-tag">Free test assets</p><h1>Get demo stocks.</h1><p>These are testnet-only mock shares. They have no money value and are not real or official tokenized stocks. Each stock is tracked separately, so dAAPL cannot satisfy a dTSLA campaign.</p>{contract ? <p className="contract-line">Faucet contract <a href={`${EXPLORER}/address/${contract}`} target="_blank" rel="noreferrer">{short(contract)}</a></p> : <p className="contract-line">Create a campaign first to initialize the multi-stock demo contract.</p>}</section>
    <section className="demo-stock-grid">{DEMO_ASSETS.map((item) => <article className={`demo-stock-card ${selectedAsset === item.symbol ? "selected" : ""}`} key={item.symbol} onClick={() => setSelectedAsset(item.symbol)}><div><span>{item.ticker}</span><small>{item.name}</small></div><strong>{item.symbol}</strong><p>1 free demo share per wallet, per test contract.</p>{address ? <button onClick={(event) => { event.stopPropagation(); claim(item.symbol); }} disabled={!!busy || !contract}>{busy === `faucet-${item.symbol}` || busy === "confirming" ? "Working…" : `Get 1 ${item.symbol}`}</button> : <button onClick={(event) => { event.stopPropagation(); connect(); }}>Connect wallet</button>}</article>)}</section>
    <div className="page-cta compact"><h2>Need gas too?</h2><a className="primary" href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">Get free test OKB <ArrowSquareOut size={17} /></a></div>
  </main>;
}

function DashboardPage({ campaigns, edit, copy }: { campaigns: Campaign[]; edit: (campaign: Campaign) => void; copy: (value: string) => void }) {
  return <main className="page-shell">
    <section className="page-hero narrow"><p className="intro-tag">Creator dashboard</p><h1>Your campaigns only.</h1><p>The backend verifies your wallet signature before returning this list. A visitor cannot load another creator’s private settings by changing a URL.</p></section>
    <section className="dashboard-grid">{campaigns.map((campaign) => <article className="dashboard-card" key={campaign.id}><div><span className="row-symbol">{campaign.asset_symbol}</span><small>/c/{campaign.id}</small></div><h2>{campaign.title}</h2><p>{campaign.description}</p><dl><div><dt>Rule</dt><dd>Hold {campaign.minimum_display} {campaign.asset_symbol}</dd></div><div><dt>Status</dt><dd>{campaign.status}</dd></div></dl><div className="dashboard-actions"><button onClick={() => copy(`${window.location.origin}/c/${campaign.id}`)}>Copy link</button><button onClick={() => edit(campaign)}>Change private destination</button></div></article>)}</section>
    {!campaigns.length && <div className="empty-state-large"><ShieldCheck size={35} /><h2>No campaigns for this wallet.</h2><p>Connect the wallet that published your xPerks campaigns.</p></div>}
  </main>;
}

function HowPage({ create, faucet }: { create: () => void; faucet: () => void }) {
  return <main className="page-shell"><section className="page-hero narrow"><p className="intro-tag">How it works</p><h1>Stock first.<br />Perk second.</h1><p>The testnet demo mirrors the production idea with separate onchain mock balances, creator-owned campaigns, and protected perk delivery.</p></section><section className="process-grid"><article><b>01</b><Gift size={28} /><h2>Get a demo stock</h2><p>Choose TSLA, NVDA, AAPL, COIN, MSFT, AMZN, or MSTR. The contract records that specific mock asset in your wallet.</p></article><article><b>02</b><Wallet size={28} /><h2>Open /c/…</h2><p>Every campaign has its own numeric share link. Connect the wallet you want checked.</p></article><article><b>03</b><ShieldCheck size={28} /><h2>Verify and unlock</h2><p>The contract checks the required asset and amount. The private destination stays offchain until the wallet passes.</p></article></section><section className="page-cta"><h2>Try the full judge flow.</h2><div className="cta-actions"><button className="primary" onClick={faucet}>Get demo stocks</button><button className="primary inverse" onClick={create}>Create campaign <ArrowRight size={18} /></button></div></section></main>;
}

function FaqPage() {
  const questions = [
    ["Are these real stocks?", "No. dTSLA, dNVDA, dAAPL, dCOIN, dMSFT, dAMZN, and dMSTR are free testnet demo assets with no financial value."],
    ["Does owning one demo stock qualify me for every campaign?", "No. Each asset has a separate onchain balance. A wallet holding dAAPL does not pass a dTSLA rule."],
    ["Does every campaign get its own link?", "Yes. Campaigns use permanent numeric URLs such as /c/18. The number identifies the campaign, while wallet signatures control creator-only actions."],
    ["Can someone edit my campaign by changing the number in the URL?", "No. Public campaign pages are shareable, but creator management requires a fresh signature from the wallet that created the onchain campaign."],
    ["Why do I need test OKB?", "X Layer testnet transactions still need gas. The OKB is free from the testnet faucet and has no mainnet value."],
    ["What changes for production?", "The demo mock assets would be replaced by supported issuer token contracts. The same idea is then a balance check against the real token contract rather than a demo balance."],
  ];
  return <main className="page-shell faq-page"><section className="page-hero narrow"><p className="intro-tag">Frequently asked</p><h1>Clear answers.<br />No fake ownership.</h1></section><section className="faq-list">{questions.map(([question, answer], index) => <details key={question} open={index === 0}><summary><span>0{index + 1}</span>{question}<b>+</b></summary><p>{answer}</p></details>)}</section></main>;
}

function errorText(cause: unknown) {
  const error = cause as { shortMessage?: string; message?: string; code?: number };
  if (error?.code === 4001) return "Wallet request rejected. You can try again when ready.";
  const message = error?.shortMessage || error?.message || "Something went wrong. Try again.";
  if (/unrecognized chain|unknown chain|chain.*not added/i.test(message)) return "Your wallet could not add X Layer automatically. Add X Layer Testnet in the wallet network settings and try again.";
  if (/insufficient funds/i.test(message)) return "This wallet needs free test OKB for gas. Use the X Layer testnet faucet and try again.";
  if (/Already received this demo asset/i.test(message)) return "This wallet already received its free demo share for that stock on this test contract.";
  return message.split("\n")[0].slice(0, 260);
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
