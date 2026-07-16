# tabclear-requests — Soroban contract

On-chain payment requests for Tabclear (Yellow Belt). A merchant opens a request
(`create_request`), anyone can read it (`get_request`), and the merchant marks it
settled (`mark_paid`) once the customer's XLM payment lands. Creation and payment
each emit an event the dashboard streams live.

## API

| Function | Auth | Purpose |
|---|---|---|
| `create_request(merchant, amount, memo) -> u32` | merchant | Open a request, returns its id |
| `get_request(id) -> Request` | none | Read a request |
| `mark_paid(id)` | merchant | Settle a request (rejects double-pay) |
| `total_requests() -> u32` | none | Count of requests created |

Events: `("created", merchant) -> (id, amount)` and `("paid", merchant) -> id`.
Errors: `NotFound = 1`, `AlreadyPaid = 2`, `InvalidAmount = 3`.

## Prerequisites

```bash
# Rust + the only Wasm target the Stellar runtime supports
rustup target add wasm32v1-none        # (wasm32-unknown-unknown on older toolchains)
# Stellar CLI
cargo install --locked stellar-cli
```

## Build

```bash
stellar contract build
# -> target/wasm32v1-none/release/tabclear_requests.wasm
```

## Test

```bash
cargo test
```

## Deploy to testnet

```bash
stellar keys generate deployer --network testnet --fund

stellar contract deploy \
  --wasm target/wasm32v1-none/release/tabclear_requests.wasm \
  --source-account deployer \
  --network testnet
# -> prints the CONTRACT_ID
```

Put the printed id in the frontend env as `VITE_CONTRACT_ID` (see `tabclear/.env.example`).

## Troubleshooting
If the deployed contract ID is not immediately visible via `stellar contract fetch --id`, the uploaded WASM may still be reachable by hash after indexing completes:

```bash
stellar contract fetch --wasm-hash 4b87574db8474f6cd8c8f64e85b3ef313b6a8bb2f268facd6ab2fb343f5c0cea \
  --network testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -o fetched.wasm
```

## Try it from the CLI

```bash
stellar contract invoke --id <CONTRACT_ID> --source-account deployer --network testnet \
  -- create_request --merchant <G...> --amount 100 --memo "table 4"

stellar contract invoke --id <CONTRACT_ID> --source-account deployer --network testnet \
  -- get_request --id 1
```
