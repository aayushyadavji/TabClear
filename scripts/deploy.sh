#!/usr/bin/env bash
# One-shot deploy + wire for Tabclear's two contracts on Stellar Testnet.
#
#   build both wasms -> deploy requests -> deploy settlement -> initialize both
#   -> wire settlement into requests -> smoke-test -> print the .env block.
#
# Requirements: stellar CLI (>=23), a funded testnet identity.
# Usage:  IDENTITY=deployer ./scripts/deploy.sh
set -euo pipefail

IDENTITY="${IDENTITY:-deployer}"
NETWORK="${NETWORK:-testnet}"
CONTRACTS_DIR="$(cd "$(dirname "$0")/../contracts" && pwd)"

echo "==> Using identity '$IDENTITY' on '$NETWORK'"
ADMIN=$(stellar keys address "$IDENTITY")
echo "    admin/deployer address: $ADMIN"

echo "==> Building contracts"
( cd "$CONTRACTS_DIR" && stellar contract build )

REQ_WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/tabclear_requests.wasm"
SET_WASM="$CONTRACTS_DIR/target/wasm32v1-none/release/tabclear_settlement.wasm"

echo "==> Deploying tabclear-requests"
REQUESTS_ID=$(stellar contract deploy --wasm "$REQ_WASM" --source "$IDENTITY" --network "$NETWORK")
echo "    tabclear-requests: $REQUESTS_ID"

echo "==> Deploying tabclear-settlement"
SETTLEMENT_ID=$(stellar contract deploy --wasm "$SET_WASM" --source "$IDENTITY" --network "$NETWORK")
echo "    tabclear-settlement: $SETTLEMENT_ID"

echo "==> Resolving native XLM SAC address"
XLM_SAC=$(stellar contract id asset --asset native --network "$NETWORK")
echo "    native SAC: $XLM_SAC"

echo "==> Initializing tabclear-requests (admin = $ADMIN)"
stellar contract invoke --id "$REQUESTS_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- initialize --admin "$ADMIN"

echo "==> Initializing tabclear-settlement (requests + token)"
stellar contract invoke --id "$SETTLEMENT_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- initialize --requests "$REQUESTS_ID" --token "$XLM_SAC"

echo "==> Wiring settlement into requests (set_settlement)"
stellar contract invoke --id "$REQUESTS_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- set_settlement --settlement "$SETTLEMENT_ID"

echo "==> Smoke test: total_requests()"
stellar contract invoke --id "$REQUESTS_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- total_requests

cat <<EOF

============================================================
 Deploy complete. Paste into tabclear/.env (and Vercel env):
============================================================
VITE_REQUESTS_ID=$REQUESTS_ID
VITE_SETTLEMENT_ID=$SETTLEMENT_ID
============================================================
EOF
