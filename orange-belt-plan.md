
# Tabclear — Level 3 (Orange Belt) Build Plan

> Goal: evolve Tabclear from a Yellow Belt demo into a **production-shaped dApp**:
> atomic on-chain settlement via **inter-contract calls**, CI/CD, tests on both
> sides, a mobile-first UI, and a polished demo video.

**Judged on:** quality + complexity + execution ($50/winner). Every requirement
below maps to a concrete deliverable in the repo.

---

## 0. The story (what makes this "advanced")

Yellow Belt has a weakness we turn into the Orange Belt headline:
paying a request today takes **two separate transactions** (XLM payment via
Horizon, then `mark_paid` via Soroban). The customer can pay and the
`mark_paid` can still fail — state can go inconsistent.

**Orange Belt fix: `tabclear-settlement`, a second contract that settles a
request atomically in ONE transaction** by cross-calling two other contracts:

```
customer ──invoke──> tabclear-settlement.pay_request(id, payer)
                          │
                          ├──> tabclear-requests.get_request(id)                 (cross-contract read)
                          ├──> native XLM SAC.transfer(payer → merchant, amount) (token contract call)
                          └──> tabclear-requests.settle(id, payer)               (cross-contract write)
                          └──> emits ("settled", id) -> (payer, merchant, amount)
```

Either everything succeeds or the whole transaction rolls back — real
inter-contract communication with real (testnet) money movement, not a toy.

---

## 1. Smart contracts (advanced development + inter-contract communication)

### 1a. Upgrade `tabclear-requests` → v2

| Function | Change |
|---|---|
| `initialize(admin)` | store admin; required before use |
| `set_settlement(addr)` | admin-only; wires the settlement contract after both deploy |
| `create_request(merchant, amount, memo)` | also store `created_at` ledger timestamp |
| `settle(id, payer)` | **only callable by the settlement contract**; records `paid_by` + `paid_at` |
| `cancel_request(id)` | merchant-only; new `Cancelled` status |
| `list_requests(start, limit)` | paginated reads so the UI stops guessing ids |
| `mark_paid(id)` | keep for backwards compat (merchant-only) |

Data upgrade:
`Request { merchant, amount, memo, status: Open|Paid|Cancelled, created_at, paid_by: Option<Address>, paid_at: Option<u64> }`

New errors: `Unauthorized = 4`, `Cancelled = 5`, `NotInitialized = 6`.

### 1b. New `tabclear-settlement` contract

- `initialize(requests_contract, xlm_token)` — store both addresses
- `pay_request(id, payer)`:
  1. `payer.require_auth()`
  2. cross-call `requests.get_request(id)` → reject unless status is `Open`
  3. cross-call `token::Client::transfer(payer, merchant, amount)`
     (native XLM SAC — address from `stellar contract id asset --asset native --network testnet`)
  4. cross-call `requests.settle(id, payer)`
  5. emit `("settled", id) -> (payer, merchant, amount)`
- Uses `soroban_sdk::token::Client` — the canonical inter-contract pattern.

### 1c. Contract tests (checklist wants 3+ passing; we'll have ~12)

- Keep the 5 existing tests; add: settle-only-by-settlement-contract,
  cancel flow, cancelled-cannot-be-paid, pagination bounds.
- `tabclear-settlement` tests using `env.register_stellar_asset_contract_v2()`
  to mint test XLM: atomic settle moves balances AND flips status in one call;
  insufficient balance reverts everything; double-settle rejected.
- **The `cargo test` output is one of the required screenshots.**

---

## 2. Smart contract deployment workflow

- `scripts/deploy.sh`: build both wasms → deploy requests → deploy settlement →
  `initialize` both → `set_settlement` → smoke-test with a read call → print
  contract IDs ready to paste into `.env`.
- Optional GitHub Actions workflow `deploy-contracts.yml` (`workflow_dispatch`)
  running the same script against testnet with a funded key in GitHub Secrets —
  makes the "deployment workflow" requirement visible in the Actions tab.
- Rollout order documented in the README (deploy → wire → verify).

---

## 3. CI/CD pipeline (required screenshot: pipeline running)

`.github/workflows/ci.yml` on every push/PR to `main`:

| Job | Steps |
|---|---|
| `contracts` | rustup + wasm target + cargo cache → `cargo test` (both contracts) → `stellar contract build` → upload wasm artifacts |
| `frontend` | `npm ci` → `tsc -b` → `vitest run` → `vite build` |
| `deploy` | Vercel auto-deploy from main (already wired from White Belt) |

- CI badge at the top of the README.
- **Screenshot the green Actions run** for the submission.

---

## 4. Frontend upgrades

### 4a. Atomic pay flow (biggest UX win)
- "Pay a request" sends **one transaction** through `tabclear-settlement`.
- New `src/lib/settlement.ts` (build → simulate → sign → send → confirm).
- QR payload unchanged; payer no longer does the two-step dance.

### 4b. Event streaming & real-time updates (upgrade from 6s full re-poll)
- Ledger-cursor streaming: remember `latestLedger`, fetch only new events each
  tick; optimistic UI on own txs; toast on incoming `settled` events
  ("💰 Request #6 was just paid").
- Live request list from `list_requests` — real data, not id guessing.

### 4c. Mobile responsive (required screenshot)
- Under 768px: sidebar becomes a bottom tab bar; requests grid → single column;
  QR card full-width; modals become full-screen sheets.
- Verify at 375×812; **screenshot the mobile UI** for the submission.

### 4d. Error handling & loading states
- Skeleton loaders for balance, request list, events feed.
- Error boundary around the dashboard; retry-with-backoff on RPC reads.
- Distinct loading / empty / error states everywhere.
- Keep the 3 typed wallet errors; surface contract errors from simulation.

### 4e. Frontend tests (vitest + @testing-library/react, run in CI)
- Unit: stroops↔XLM round-trip, `readableError` all branches, QR payload
  encode/decode.
- Component: RequestsPanel skeleton→data, SendModal validation, status pills.
- ~10 tests; **test output screenshot** can show cargo + vitest together.

---

## 5. Production-ready architecture practices

- `src/lib/` split by responsibility: `stellar.ts` (config/Horizon),
  `contract.ts` (requests), `settlement.ts`, `events.ts` (streaming).
- All config from env; `.env.example` documents every var; zero secrets in repo.
- One typed decoding layer (no scattered `scValToNative` in components).
- Error taxonomy: wallet / network / contract → consistent user copy.
- Quick Lighthouse pass on the live site (perf + a11y wins).

---

## 6. Documentation & demo presentation

- **ORANGE BELT README.md**: architecture diagram (cross-call flow), contract
  addresses, interaction tx hash, CI badge, the three required screenshots,
  setup + deploy workflow, requirement→where table (like Yellow Belt's).
- Root README: add Orange Belt section + link + live demo URL.
- **Demo video (1–2 min)** — script:
  1. (0:00) Mobile viewport → connect wallet
  2. (0:20) Create request → QR appears
  3. (0:40) Second wallet pays via **one atomic transaction** → open explorer:
     transfer + settle visible in the SAME tx
  4. (1:10) Live "settled" toast pops on the merchant screen
  5. (1:30) Flash green CI run + test output → end
  Record with OBS/Loom → YouTube (unlisted) → link in README.

---

## 7. Submission checklist → deliverable map

| Checklist item | Covered by |
|---|---|
| Public GitHub repo | existing repo |
| README with complete documentation | §6 |
| **10+ meaningful commits** | commit plan below (12) |
| Live demo link | Vercel (add `VITE_*` contract IDs to project env) |
| Contract deployment address | both v2 addresses in README |
| Tx hash for contract interaction | a real `pay_request` tx |
| Screenshot: mobile responsive UI | §4c |
| Screenshot: CI/CD pipeline running | §3 |
| Screenshot: test output 3+ passing | §1c + §4e |
| Demo video link (1–2 min) | §6 |

## Commit plan (12 meaningful commits)

1. `requests v2: status enum, timestamps, cancel, pagination`
2. `requests v2: settlement-gated settle() + expanded tests`
3. `settlement contract: atomic pay_request via XLM SAC cross-call`
4. `settlement contract: tests with asset-contract fixture`
5. `scripts: one-shot deploy + wire workflow`
6. `ci: contracts + frontend pipeline with badge`
7. `frontend: settlement client + one-tx pay flow`
8. `frontend: ledger-cursor event streaming + live toasts`
9. `frontend: mobile responsive layout (bottom nav, sheets)`
10. `frontend: skeletons, error boundary, retry logic`
11. `tests: vitest unit + component coverage`
12. `docs: ORANGE BELT README, screenshots, demo video link`

---

## 8. Build order (dependency-safe)

| Phase | Work | Depends on |
|---|---|---|
| 1 | requests v2 + tests | — |
| 2 | settlement contract + tests | 1 |
| 3 | deploy script; deploy both to testnet | 2 |
| 4 | CI pipeline green | 1–2 |
| 5 | frontend settlement flow + event streaming | 3 |
| 6 | mobile responsive + loading/error states | 5 |
| 7 | frontend tests | 5–6 |
| 8 | Vercel env vars + live demo verify | 3, 6 |
| 9 | docs, 3 screenshots, demo video | everything |

---

## 9. Risks / notes

- **Native XLM SAC**: fetch once with
  `stellar contract id asset --asset native --network testnet`; stable per
  network. Settlement moves real testnet XLM; amounts stay stroops (i128).
- **`settle` auth**: gate on the stored settlement address
  (`require_auth` on the settlement contract address inside `settle`) —
  covered by a dedicated negative test.
- **Windows toolchain**: build locally with `RUSTUP_TOOLCHAIN=stable-gnu`
  (this machine's MSVC lacks the Windows SDK); CI runs Linux so no issue there.
- **SDK 16 + protocol 27**: already proven working in Yellow Belt.
- Yellow Belt contract stays deployed for history; Orange deploys fresh v2
  addresses → `.env` gains `VITE_REQUESTS_ID` + `VITE_SETTLEMENT_ID`.
- Old plan content (partial payments, expiry, receipts, cash-out mock) is
  superseded by the official Level 3 requirements; receipts/cash-out can
  return at a later belt.
