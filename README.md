# Tabclear — Instant Merchant Settlement on Stellar

Tabclear is a point-of-sale flow for small merchants: a customer taps to pay and the
merchant's till updates the second the payment confirms — no settlement lag, no
end-of-day batch, no card processor holding the funds.

This is a **White Belt** Stellar dApp — connect a Freighter wallet, view your XLM
balance, send a testnet payment, and see it settle instantly, backed by real
on-chain transaction history.

## Screenshots

| Wallet connected & balance | Send payment |
|---|---|
| ![Wallet connected and balance](assets/screenshots/wallet%20connected%20and%20balance.png) | ![Send payment form](assets/screenshots/send%20form%20payment.png) |

| Payment settled | Activity on dashboard |
|---|---|
| ![Payment done](assets/screenshots/payment%20done.png) | ![Transaction on dashboard](assets/screenshots/transcation%20show%20on%20dashboard.png) |

Transaction verified on the [Stellar Expert testnet explorer](assets/screenshots/transaction%20explorer.png).

## Features

- **Connect / disconnect** a Freighter wallet (testnet)
- **Balance display** — reads the connected account's native XLM balance from Horizon
- **Fund via Friendbot** — one click to fund an unfunded testnet account
- **Send XLM** — build → sign (Freighter) → submit, with clear success/failure feedback
- **Instant confirmation** — transaction hash + Stellar Expert link, balance auto-refreshes
- **Transaction history** — real on-chain payment history for the connected wallet

## Tech stack

- **Frontend:** Vite + React + TypeScript
- **Wallet:** Freighter (`@stellar/freighter-api`)
- **SDK:** `@stellar/stellar-sdk` (Horizon for balances + classic payments)
- **Network:** Stellar Testnet

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

See [WHITE BELT README.md](WHITE%20BELT%20README.md) for full setup, prerequisites, and the demo walkthrough.

## License

[MIT](LICENSE) © Aayush Yadav
