# Tabclear — White Belt

> First working Stellar dApp on testnet: connect a Freighter wallet, show its XLM
> balance, send a testnet payment, and confirm the result — all with clear feedback.

This is the White Belt submission for Tabclear. See the [main README](README.md) for a
quick overview and screenshots.

## What it does

- **Connect / disconnect** a Freighter wallet (testnet)
- **Display balance** — reads the connected account's native XLM balance from Horizon
- **Send a payment** — build → sign (Freighter) → submit an XLM payment from the
  connected wallet to any destination address
- **Confirmation** — shows success/failure, the transaction hash, and a link to
  Stellar Expert (testnet), then refreshes the balance so it visibly updates
- **Transaction history** — loads real on-chain payment history for the wallet

## Requirements checklist

- [x] Freighter installed, testnet selected
- [x] Wallet connect implemented
- [x] Wallet disconnect implemented
- [x] Fetch connected wallet's XLM balance via Horizon
- [x] Display balance clearly in UI
- [x] Send an XLM transaction on testnet
- [x] Show success/failure state to user
- [x] Show transaction hash / confirmation message
- [x] Public GitHub repo
- [x] README with description, setup, and screenshots

## Prerequisites

- **Node.js 20+** (the Stellar SDK dropped Node 18)
- **Freighter** browser extension — https://www.freighter.app/
  - Create a wallet, then switch the network to **Testnet** in Freighter settings
- A funded testnet account — fund via Friendbot (or the in-app button):
  `https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY`

## Setup

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

## Environment

Defaults target Stellar **Testnet**; no env vars are required to run locally.

| Setting | Value |
|---------|-------|
| Horizon | `https://horizon-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| Friendbot | `https://friendbot.stellar.org` |
| Explorer | `https://stellar.expert/explorer/testnet` |

## How to demo

1. Open the app, click **Connect & get started**, approve in Freighter.
2. Your XLM balance appears on the dashboard ("Available now"). If unfunded, click **Fund with Friendbot**.
3. Click **Send payment**, enter a destination address + amount, and sign in Freighter.
4. On success the tx hash + explorer link appear and the balance refreshes.

## Screenshots

### Wallet connected & balance displayed
![Wallet connected and balance](assets/screenshots/wallet%20connected%20and%20balance.png)

### Send payment form
![Send payment form](assets/screenshots/send%20form%20payment.png)

### Payment success (tx hash + explorer link)
![Payment done](assets/screenshots/payment%20done.png)

### Transaction shown on dashboard
![Transaction on dashboard](assets/screenshots/transcation%20show%20on%20dashboard.png)

### Transaction on Stellar Expert explorer
![Transaction explorer](assets/screenshots/transaction%20explorer.png)

## Troubleshooting

- **"Freighter not installed"** — install the extension and reload.
- **Balance shows 0 / account not found** — fund the account via Friendbot first.
- **Network mismatch** — make sure Freighter is set to Testnet.
- **Insufficient balance** — testnet accounts need XLM for the payment + fee; re-fund via Friendbot.
