# Yellow Belt — Tabclear (QR Payment Requests + Soroban Contract)

**Level goal (program):** Multi-wallet integration, deploy a smart contract to
testnet, call it from the frontend, real-time event handling, and visible
transaction status.

White Belt is **done** (multi-wallet, balance, send, history, deployed to Vercel
with Analytics). Yellow Belt turns Tabclear from "send a raw payment" into
"merchant issues an on-chain payment request → shows a QR → customer scans and
pays against it → a Soroban contract records the request and its payment as
events, which the dashboard streams live."

---

## What we're building (the QR Payment Request flow)

1. **Merchant** opens the **Requests** tab, enters an amount + memo, and clicks
   *Create request*. This calls the contract's `create_request` → returns a
   `request_id`. The contract emits a `RequestCreated` event.
2. The app renders a **QR code** encoding the request (`contractId` + `request_id`
   + amount + memo). The merchant shows it to the customer.
3. **Customer** (same app, different wallet) scans/pastes the request → the app
   reads the request from the contract (`get_request`) → customer signs a normal
   XLM payment to the merchant → on success the app calls `mark_paid(request_id)`
   → contract emits `RequestPaid`.
4. The dashboard **activity feed** subscribes to contract events and updates the
   request from *Pending* → *Paid* in real time, with a **status pill**
   (pending / success / failed) and a Stellar Expert link for the contract call.

This satisfies every Level 2 requirement in one coherent product story.

---

## Requirements → where each is met

| Level 2 requirement | How Tabclear meets it |
|---|---|
| 3 error types handled | (1) wallet not found / not installed, (2) user rejected signature, (3) insufficient balance — plus request-already-paid and contract-call failure |
| Contract deployed on testnet | `tabclear-requests` Soroban contract, deployed via `stellar contract deploy`; address recorded in README + `.env` |
| Contract called from frontend | `create_request`, `mark_paid`, `get_request` invoked via `@stellar/stellar-sdk` RPC |
| Transaction status visible | Status pill on every request + send flow: pending → success → failed, with tx hash + explorer link |
| Multi-wallet | Swap direct Freighter calls for **Stellar Wallets Kit** (Freighter + Albedo + xBull/LOBSTR) |
| Real-time events | Poll `getEvents` (RPC) for the contract's `RequestCreated` / `RequestPaid` topics; merge into the activity feed |
| 2+ meaningful commits | Contract, wallet-kit swap, frontend integration, events, docs = 5+ commits |

---

## Tech stack additions

- **Multi-wallet:** `@creit.tech/stellar-wallets-kit` (`WalletNetwork.TESTNET`) —
  one connect/disconnect/sign interface across Freighter, Albedo, xBull, LOBSTR.
- **Contract toolchain:** `stellar-cli` (v27, protocol 27), Rust with
  `wasm32v1-none` target, `soroban-sdk`.
- **RPC:** add a Soroban RPC server (`https://soroban-testnet.stellar.org`) to
  `lib/stellar.ts` — needed for `simulateTransaction`, `sendTransaction`,
  polling `getTransaction`, and `getEvents`.
- **QR:** `qrcode.react` (render) + `html5-qrcode` or manual paste (scan).

---

## Build plan

### Step 1 — Multi-wallet layer (Stellar Wallets Kit)
1. `npm i @creit.tech/stellar-wallets-kit qrcode.react`
2. Replace `hooks/useFreighter.ts` with `hooks/useWallet.ts` backed by
   `StellarWalletsKit` (keep the same `{ connected, address, network, connect,
   disconnect, sign }` shape so `App.tsx` / `Dashboard.tsx` barely change).
3. `connect()` opens the kit modal (`kit.openModal`) so the user picks a wallet;
   persist the selected wallet id for silent restore.
4. Map kit errors to our three handled types (see Error handling below).

### Step 2 — Write the contract (`tabclear-requests`)
```bash
stellar contract init tabclear-requests
rustup target add wasm32v1-none
```
State + API:
```rust
#[contracttype]
pub struct Request {
    pub merchant: Address,
    pub amount:   i128,
    pub memo:     String,
    pub paid:     bool,
}

// create_request(merchant, amount, memo) -> u32   (merchant.require_auth)
//   -> emits RequestCreated { #[topic] merchant, id, amount }
// get_request(id) -> Request
// mark_paid(id)                                    (merchant.require_auth)
//   -> requires !paid (Error::AlreadyPaid), sets paid=true
//   -> emits RequestPaid { #[topic] merchant, id }
```
- Typed errors: `NotFound = 1`, `AlreadyPaid = 2`.
- A `Counter` in instance storage issues sequential `request_id`s.
- Extend instance TTL on writes so state isn't archived.
- Unit tests (`env.mock_all_auths()`): create → get → mark_paid → assert
  `AlreadyPaid` on double-pay; assert events published.

### Step 3 — Build, deploy, verify via CLI
```bash
stellar contract build
stellar keys generate deployer --network testnet --fund
stellar contract deploy --wasm target/wasm32v1-none/release/tabclear_requests.wasm \
  --source-account deployer --network testnet
stellar contract invoke --id <CID> --source-account deployer --network testnet \
  -- create_request --merchant <G...> --amount 100 --memo "table 4"
```
Record the **contract ID** and a **sample call tx hash** — both go in the README.

### Step 4 — Frontend contract integration
1. `lib/contract.ts`: build → `simulateTransaction` → `assembleTransaction` →
   sign (wallet kit) → `sendTransaction` → poll `getTransaction`. One helper per
   method (`createRequest`, `markPaid`, `getRequest`).
2. **Requests tab** (currently a placeholder) becomes real: create-request form →
   QR card (`qrcode.react`) → shareable request.
3. **Pay flow:** scan/paste request id → `getRequest` → existing send-payment
   modal prefilled with merchant + amount → on payment success call `markPaid`.

### Step 5 — Real-time events + status tracking
1. `lib/events.ts`: poll RPC `getEvents` for the contract's topics since the last
   ledger; map to activity records; merge into the dashboard feed (dedupe by id,
   like the current Horizon merge).
2. Add a `TxStatus = "pending" | "success" | "failed"` pill component; drive it
   from the invoke lifecycle (simulate/sign/send/confirm) and from events.

### Step 6 — Error handling (the 3 required, explicit)
- **Wallet not found / not installed** → kit throws on connect; show install CTA.
- **User rejected signature** → detect reject error from `sign`; toast + reset to
  idle, no orphaned pending state.
- **Insufficient balance** → surface `op_underfunded` (payment) and simulation
  failure (contract) as "not enough XLM for amount + fee."
- Bonus: request already paid (`AlreadyPaid`), contract call/simulation failure.

### Step 7 — Docs + submission
- Update root README + rename/extend the belt README to **YELLOW BELT README.md**:
  wallet options screenshot, **deployed contract address**, a **contract-call tx
  hash** (verifiable on Stellar Expert), Rust/`stellar-cli` setup, live Vercel link.
- 5+ commits: contract, wallet-kit, contract integration, events+status, docs.

---

## UI changes (what visibly changes vs White Belt)

- **Connect** button opens a **wallet picker modal** (Freighter/Albedo/xBull/
  LOBSTR) instead of going straight to Freighter — screenshot this for the README.
- **Requests** sidebar tab: from placeholder → real create-request form + **QR
  code card** + list of open requests with status pills.
- **Activity feed**: each row gains a **status pill** (pending/success/failed) and
  contract-event rows appear live alongside Horizon payments.
- **Send modal**: gains a "paying request #N" context header when reached via a QR
  scan, and a live status stepper (simulating → sign → submitting → settled).
- **Settings**: add the **contract address** row (copyable + explorer link).
- Keep the cream/moss market-stall theme; new components reuse existing panel,
  pill, and button styles.

---

## Reference docs
- Smart contracts: https://developers.stellar.org/docs/build/smart-contracts
- Events: https://developers.stellar.org/docs/build/smart-contracts/example-contracts/events
- Stellar CLI: https://developers.stellar.org/docs/tools/cli/stellar-cli
- Stellar Wallets Kit: https://github.com/Creit-Tech/Stellar-Wallets-Kit
- RPC getEvents: https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents

## Estimated time
~1–2 weeks — the Rust contract + RPC invoke lifecycle is the main learning curve;
the wallet-kit swap and UI are incremental over the existing dashboard.
