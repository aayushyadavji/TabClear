# Tabclear — Yellow Belt

> Building on White Belt: **multi-wallet** connect, a **Soroban smart contract**
> deployed to testnet, **contract calls from the frontend**, **real-time contract
> events**, and **visible transaction status** (pending / success / failed).

This is the Level 2 (Yellow Belt) submission for Tabclear. See the
[main README](README.md) for the overview. White Belt (wallet connect, balance,
XLM payment, history) is complete — this level adds on-chain payment requests.

## What's new in Yellow Belt

Tabclear grows from "send a raw payment" to **on-chain QR payment requests**:

1. **Merchant** opens the **Requests** tab, enters an amount + memo, and clicks
   *Create request* → this calls the contract's `create_request`, which emits a
   `created` event and returns a request id.
2. The app renders a **QR code** encoding the request (contract id, request id,
   amount, merchant).
3. **Customer** scans/pastes the request id → the app reads it from the contract
   (`get_request`) → prefills the send form → customer pays the merchant in XLM.
4. On payment success the app calls `mark_paid`, the contract emits a `paid`
   event, and the **live contract-events feed** updates in real time.

## Level 2 requirements — where each is met

| Requirement | Where |
|---|---|
| **Multi-wallet** | Stellar Wallets Kit — Freighter, Albedo, xBull, LOBSTR (`src/hooks/useWallet.ts`) |
| **3 error types handled** | (1) wallet not found/installed, (2) signature rejected, (3) insufficient balance — in `readableError` (`src/lib/stellar.ts`); plus contract `AlreadyPaid` / `NotFound` |
| **Contract deployed on testnet** | `tabclear-requests` (`contracts/tabclear-requests/`) |
| **Contract called from frontend** | `create_request`, `get_request`, `mark_paid` via RPC (`src/lib/contract.ts`) |
| **Transaction status visible** | Status pills (pending/success/failed) + send stepper + tx hashes with explorer links |
| **Real-time events** | RPC `getEvents` polled every 6s, streamed into the Requests panel |
| **2+ meaningful commits** | contract, wallet-kit, contract integration, events/UI, docs |

## Deployed contract

| | |
|---|---|
| **Contract address** | `CD63PPTXJIJCXBVV72JNWOQ4CEKM2AQF2MVMX52OYLFZI6RPG7XRLMW3` |
| **Explorer** | https://stellar.expert/explorer/testnet/contract/CD63PPTXJIJCXBVV72JNWOQ4CEKM2AQF2MVMX52OYLFZI6RPG7XRLMW3 |
| **Sample contract-call tx hash (`create_request`)** | `916d256b4977ce358b5f7552ce8a6f0444675f1788b6954ff2285a6d5e191ada` |
| **Verify the call** | https://stellar.expert/explorer/testnet/tx/916d256b4977ce358b5f7552ce8a6f0444675f1788b6954ff2285a6d5e191ada |
| **Deploy tx hash** | `827d277e0b320452b2a86c5f403faaa6398ca405225971ebb7b7355f912f2602` |
| **Verify the deploy** | https://stellar.expert/explorer/testnet/tx/827d277e0b320452b2a86c5f403faaa6398ca405225971ebb7b7355f912f2602 |

## Screenshots

### Wallet options (multi-wallet picker)
![Wallet options](assets/screenshots/multi-wallet.png)

### Create request + QR code (with live contract events feed)
![Create request and QR](assets/screenshots/Create%20request%20and%20QR.png)

### Transaction status (payment settled + tx hash)
![Transaction status](assets/screenshots/Transaction%20status.png)

### Contract call verified on Stellar Expert
![Contract call on Stellar Expert](assets/screenshots/contract%20events.png)

## The contract (`tabclear-requests`)

Rust / `soroban-sdk`. Full details in
[contracts/tabclear-requests/README.md](contracts/tabclear-requests/README.md).

| Function | Auth | Purpose |
|---|---|---|
| `create_request(merchant, amount, memo) -> u32` | merchant | Open a request |
| `get_request(id) -> Request` | none | Read a request |
| `mark_paid(id)` | merchant | Settle a request (rejects double-pay) |
| `total_requests() -> u32` | none | Count of requests |

Events: `("created", merchant) -> (id, amount)`, `("paid", merchant) -> id`.
Errors: `NotFound = 1`, `AlreadyPaid = 2`, `InvalidAmount = 3`.

## Setup

### 1. Frontend
```bash
npm install
cp .env.example .env      # then paste your deployed contract id
npm run dev
```
`.env`:
```
VITE_CONTRACT_ID=<your deployed contract id>
```

### 2. Contract (build + deploy)
```bash
cd contracts/tabclear-requests
rustup target add wasm32v1-none
cargo install --locked stellar-cli   # if not installed
stellar contract build
cargo test

stellar keys generate deployer --network testnet --fund
stellar contract deploy \
  --wasm target/wasm32v1-none/release/tabclear_requests.wasm \
  --source-account deployer --network testnet
# -> copy the CONTRACT_ID into tabclear/.env as VITE_CONTRACT_ID
```

## Wallets supported

Connecting opens the Stellar Wallets Kit modal with **Freighter, Albedo, xBull,
and LOBSTR**. Set the wallet to **Testnet** before connecting.

## Environment

| Setting | Value |
|---|---|
| Horizon | `https://horizon-testnet.stellar.org` |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Explorer | `https://stellar.expert/explorer/testnet` |

## How to demo

1. Click **Connect & get started** → pick a wallet in the modal → approve.
2. Go to **Requests** → enter an amount + memo → **Create request** → watch the
   status pill go *pending → success* and a **QR code** appear.
3. From another wallet, paste the request id under **Pay a request** → **Look up
   & pay** → sign → the payment settles and the request is marked paid on-chain.
4. Watch the **Live contract events** feed update with `created` / `paid` rows,
   each linking to Stellar Expert.

## Troubleshooting

- **"Contract not configured"** — set `VITE_CONTRACT_ID` in `.env` and restart the dev server.
- **Wallet not available** — install the extension, set it to Testnet, reload.
- **Signature rejected** — you dismissed the wallet prompt; try again.
- **Insufficient balance** — fund the account via Friendbot on the Overview tab.
