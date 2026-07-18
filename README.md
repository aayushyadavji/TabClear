# Tabclear — Instant Merchant Settlement on Stellar

[![CI](https://github.com/aayushyadavji/TabClear/actions/workflows/ci.yml/badge.svg)](https://github.com/aayushyadavji/TabClear/actions/workflows/ci.yml)

**Live demo:** https://tabclear.vercel.app/ · **Demo video:** https://youtu.be/v2wjv_GUS84

Tabclear is a point-of-sale flow for small merchants: a customer taps to pay and the
merchant's till updates the second the payment confirms — no settlement lag, no
end-of-day batch, no card processor holding the funds.

Built as a **belt progression** on Stellar testnet:

- **White Belt** ✅ — connect a Freighter wallet, view your XLM balance, send a
  testnet payment, and see it settle instantly with real on-chain history.
- **Yellow Belt** ✅ — **multi-wallet** (Freighter/Albedo/xBull/LOBSTR), a deployed
  **Soroban contract** for on-chain **QR payment requests**, contract calls from the
  frontend, **real-time contract events**, and visible **transaction status**.
- **Orange Belt** ✅ — a second **`tabclear-settlement`** contract settles a request
  **atomically in one transaction** via **inter-contract calls** (cross-contract read
  + XLM SAC transfer + cross-contract write). Adds **CI/CD**, contract + frontend
  **tests**, a one-shot **deploy script**, **mobile-responsive** UI, and `settled`
  **event streaming**.

## Belt guides

- [WHITE BELT README.md](WHITE%20BELT%20README.md) — wallet connect, balance, XLM payment
- [YELLOW BELT README.md](YELLOW%20BELT%20README.md) — multi-wallet, smart contract, events
- [ORANGE BELT README.md](ORANGE%20BELT%20README.md) — atomic settlement, CI/CD, tests, deploy workflow

## Deployed contract (testnet)

| | |
|---|---|
| **Contract address** | [`CD63PPTXJIJCXBVV72JNWOQ4CEKM2AQF2MVMX52OYLFZI6RPG7XRLMW3`](https://stellar.expert/explorer/testnet/contract/CD63PPTXJIJCXBVV72JNWOQ4CEKM2AQF2MVMX52OYLFZI6RPG7XRLMW3) |
| **Sample contract-call tx** | [`916d256b…191ada`](https://stellar.expert/explorer/testnet/tx/916d256b4977ce358b5f7552ce8a6f0444675f1788b6954ff2285a6d5e191ada) (`create_request`) |

**Orange Belt (v2, atomic settlement):**

| | |
|---|---|
| **tabclear-requests v2** | [`CA7XLOMTITAAN464B65OXCNSES73CWBVGXKON54L5LNCHPUQHZE2OZMH`](https://stellar.expert/explorer/testnet/contract/CA7XLOMTITAAN464B65OXCNSES73CWBVGXKON54L5LNCHPUQHZE2OZMH) |
| **tabclear-settlement** | [`CA6WRCKBJFMWMMOAP54U7PONQWT5GVYXYKTQWIF3FI5TUFP7Y4QOIWEE`](https://stellar.expert/explorer/testnet/contract/CA6WRCKBJFMWMMOAP54U7PONQWT5GVYXYKTQWIF3FI5TUFP7Y4QOIWEE) |
| **Atomic settlement tx** | [`1421bbf2…f6704`](https://stellar.expert/explorer/testnet/tx/1421bbf2253adc04f03a24828140a4fb3f0e9f89ec432522ac998a80de4f6704) (`pay_request` — transfer + settle in one tx) |

## Screenshots

**White Belt**

| Wallet connected & balance | Send payment |
|---|---|
| ![Wallet connected and balance](assets/screenshots/wallet%20connected%20and%20balance.png) | ![Send payment form](assets/screenshots/send%20form%20payment.png) |

| Payment settled | Activity on dashboard |
|---|---|
| ![Payment done](assets/screenshots/payment%20done.png) | ![Transaction on dashboard](assets/screenshots/transcation%20show%20on%20dashboard.png) |

Transaction verified on the [Stellar Expert testnet explorer](assets/screenshots/transaction%20explorer.png).

**Yellow Belt**

| Multi-wallet picker | Create request + QR + live events |
|---|---|
| ![Wallet options](assets/screenshots/multi-wallet.png) | ![Create request and QR](assets/screenshots/Create%20request%20and%20QR.png) |

| Payment settled (tx status) | Contract call on Stellar Expert |
|---|---|
| ![Transaction status](assets/screenshots/Transaction%20status.png) | ![Contract call verified](assets/screenshots/contract%20events.png) |

**Orange Belt**

| Mobile responsive UI | Test output (11 passing) |
|---|---|
| ![Mobile responsive UI](assets/screenshots/mobile%20view.png) | ![Test output](assets/screenshots/test.png) |

CI/CD pipeline runs on every push — see the green run in the
[GitHub Actions tab](https://github.com/aayushyadavji/TabClear/actions/workflows/ci.yml)
(badge at the top of this README).

## Demo video

**Orange Belt (Level 3) — 1–2 min walkthrough:** https://youtu.be/v2wjv_GUS84

## Features

**White Belt**
- **Connect / disconnect** a wallet (testnet)
- **Balance display** — native XLM balance from Horizon
- **Fund via Friendbot** — one click to fund an unfunded testnet account
- **Send XLM** — build → sign → submit, with clear success/failure feedback
- **Instant confirmation** — transaction hash + Stellar Expert link, balance auto-refreshes
- **Transaction history** — real on-chain payment history for the connected wallet

**Yellow Belt**
- **Multi-wallet** — Stellar Wallets Kit (Freighter, Albedo, xBull, LOBSTR)
- **On-chain QR payment requests** — `tabclear-requests` Soroban contract
- **Contract calls from the UI** — create request, look up, mark paid
- **Real-time contract events** — `created` / `paid` streamed into the dashboard
- **Transaction status** — pending / success / failed pills throughout

## Tech stack

- **Frontend:** Vite + React + TypeScript
- **Wallets:** Stellar Wallets Kit (`@creit.tech/stellar-wallets-kit`)
- **SDK:** `@stellar/stellar-sdk` (Horizon for classic payments, Soroban RPC for the contract)
- **Contract:** Rust + `soroban-sdk` (`contracts/tabclear-requests/`)
- **Network:** Stellar Testnet

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

See [WHITE BELT README.md](WHITE%20BELT%20README.md) and
[YELLOW BELT README.md](YELLOW%20BELT%20README.md) for full setup, contract deploy
steps, prerequisites, and demo walkthroughs.

## License

[MIT](LICENSE) © Aayush Yadav
