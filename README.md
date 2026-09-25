# xPerks

**Stocks that unlock something.** xPerks is a Stocklana hackathon prototype built on X Layer testnet. A creator makes a stock-holder campaign, gets a permanent numeric link such as `/c/18`, and shares it. A visitor connects a wallet, proves it holds the exact required demo stock, and unlocks a private destination.

## What changed in V2

xPerks now has seven independent demo stocks:

- dTSLA
- dNVDA
- dAAPL
- dCOIN
- dMSFT
- dAMZN
- dMSTR

Each balance is separate onchain. Owning dAAPL does **not** qualify a wallet for a dTSLA campaign.

The demo-stock faucet is at `/demo-stocks`. Every demo stock is testnet-only, has no financial value, and is not a real or official tokenized stock.

## Campaign links

Every published campaign is saved in Supabase and receives a permanent numeric URL:

```
/c/18
/c/19
/c/20
```

The public link can be shared with anyone. Creator-only actions are different: the backend requires a fresh signature from the wallet that created the campaign before returning creator dashboard data or changing the private destination.

## Judge flow

1. Open a campaign such as `/c/18`.
2. Connect a wallet.
3. xPerks switches the wallet to X Layer Testnet automatically. If the network is missing, it asks the wallet to add it first.
4. If the wallet does not own the required demo stock, open **Get demo stocks**.
5. Mint the exact mock stock required by the campaign.
6. Return to the campaign and click **Verify ownership**.
7. The smart contract checks the exact asset balance and records the successful claim on X Layer.
8. After the onchain check succeeds, the backend releases the protected destination.

## Creator flow

1. Connect a wallet.
2. Choose a demo stock and minimum balance.
3. Add campaign text and a private HTTPS destination.
4. Publish.
5. xPerks stores the ownership rule on X Layer and the encrypted private destination in Supabase.
6. The creator receives a permanent `/c/{id}` link.
7. The creator dashboard only returns campaigns owned by the connected creator wallet.

## Smart contract

The V2 contract keeps separate balances for each demo stock and checks the campaign's required asset at claim time.

Main functions:

- `claimDemoAsset(asset)`
- `balanceOfAsset(asset, wallet)`
- `createBenefit(title, description, asset, minimum)`
- `claimBenefit(id)`
- `hasClaimed(id, wallet)`

Network: X Layer Testnet, chain ID `1952`.

## Backend

Supabase stores:

- permanent campaign IDs
- creator wallet
- onchain benefit ID
- required asset and minimum
- encrypted private destination

The `xperks-api` Edge Function verifies wallet signatures for creator management and checks `hasClaimed` on X Layer before revealing a private destination.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The build compiles the Solidity contract before TypeScript/Vite:

```bash
npm run build
```

## Deploy a contract manually

```bash
npm run contracts:compile
DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy
```

Fund the deployer with free **test OKB** first. Never commit a private key.

## Test a deployed V2 contract

```bash
XPERKS_CONTRACT=0x... DEPLOYER_PRIVATE_KEY=0x... npm run contracts:seed
```

This creates a dTSLA campaign, gets one dTSLA demo share, and performs a real claim transaction.

## Stack

React, TypeScript, Vite, viem, Solidity, X Layer Testnet, Supabase, Vercel.
