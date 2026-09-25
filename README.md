# xPerks

**Make ownership worth holding.** xPerks is an OKX Dev Day 2026 Remote Build prototype for the **Build a Market** track. Creators publish a benefit that requires a minimum token balance. Visitors connect a wallet, prove they hold the required amount on X Layer testnet, and record an unlock transaction.

The demo uses **dTSLA**, a free test share minted by the demo contract. dTSLA has no financial value, is not a tokenized Tesla stock, and is not affiliated with Tesla or any stock issuer.

The homepage also includes a separate **read-only mainnet check** for the actual TSLAx token at `0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0` on X Layer. A visitor can enter any wallet address and read its real TSLAx balance. That check never claims a benefit or asks for a transaction.

## Working flow

1. A creator connects an EVM wallet to X Layer testnet (chain ID `1952`) and publishes a benefit.
2. The contract stores the benefit and the minimum dTSLA balance. The creator gets a shareable `/benefit/{id}` URL.
3. A visitor connects a wallet and calls `claimDemoShares()` once to receive 1 dTSLA.
4. `claimBenefit(id)` checks the visitor's balance within the contract and emits `BenefitClaimed` if they qualify.
5. The site shows the reward message and links to the real X Layer testnet transaction.

**Important:** The demo reward message is publicly stored onchain. Do not put private links, codes, or sensitive data into it. A production version would use a separate gated delivery service, issuer-verified assets, and security review.

## Current deployment

- Network: X Layer testnet
- RPC: `https://testrpc.xlayer.tech/terigon`
- Explorer: `https://www.okx.com/web3/explorer/xlayer-test`
- Contract: [`0x56bdbf41ab0eb0fa450dbe3774504b09a034db05`](https://www.okx.com/web3/explorer/xlayer-test/address/0x56bdbf41ab0eb0fa450dbe3774504b09a034db05)
- Deployment transaction: [`0x388fee...d573b3df`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x388fee57769305a9c31f91acb96928828fc8a47bef4fdd7d2c984664d573b3df)
- Verified example claim: [`0x5e8482...6d718a7`](https://www.okx.com/web3/explorer/xlayer-test/tx/0x5e8482e339d25e1c2671bb8b0d83ce0b115ff5258fb523aec22fd50c06d718a7)
- Public product: [xperks.vercel.app](https://xperks.vercel.app)

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_XPERKS_CONTRACT` to your deployed contract address. Without it, the site shows the UI and clearly disables creation and claims.

## Deploy the contract

```bash
npm run contracts:compile
DEPLOYER_PRIVATE_KEY=0x... npm run contracts:deploy
```

Fund the deployer with **free test OKB** from the [official X Layer faucet](https://web3.okx.com/xlayer/faucet) first. Never commit a private key. Set the resulting contract address as `VITE_XPERKS_CONTRACT`, then run `npm run build`. Vercel builds the static site from `dist`.

After deployment, a test wallet with free OKB can run `XPERKS_CONTRACT=0x... DEPLOYER_PRIVATE_KEY=0x... npm run contracts:seed` to create the example benefit, collect demo shares, and verify a real claim transaction. The command prints explorer links.

## What was built for OKX Dev Day

The creator, eligibility, and benefit claim flow is new code for X Layer testnet. The product idea draws on my earlier [EquityKey](https://github.com/fawazfff/equitykey) project on Base. xPerks is a separate implementation and uses a new Solidity demo contract, new frontend, and X Layer transactions. EquityKey's existing Base contracts and Supabase service are not used by xPerks.

## Stack

React, TypeScript, Vite, viem, Solidity, X Layer testnet, Vercel.

## Demo guide

Show the homepage, publish a Tesla Holder Pack benefit, open its link, claim free dTSLA with a second wallet, unlock it, and open the X Layer testnet explorer transaction. A 2 to 4 minute video should show these live steps rather than a simulated success screen.
