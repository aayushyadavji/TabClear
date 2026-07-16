import { useState } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  buildPaymentXdr,
  submitPayment,
  readableError,
  explorerTxUrl,
} from "../lib/stellar";
import type { WalletState } from "../hooks/useWallet";
import type { TxRecord } from "../types";
import { Check } from "./icons";

type Phase = "form" | "building" | "signing" | "submitting" | "success" | "error";

interface Props {
  wallet: WalletState;
  onClose: () => void;
  onSuccess: (tx: TxRecord) => void;
  prefill?: { destination: string; amount: string; label?: string };
}

export function SendModal({ wallet, onClose, onSuccess, prefill }: Props) {
  const [destination, setDestination] = useState(prefill?.destination ?? "");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");

  const destValid =
    destination === "" || StellarSdk.StrKey.isValidEd25519PublicKey(destination.trim());
  const amountNum = Number(amount);
  const amountValid = amount === "" || (amountNum > 0 && Number.isFinite(amountNum));
  const canSubmit =
    !!wallet.address &&
    destination.trim() !== "" &&
    amount.trim() !== "" &&
    destValid &&
    amountValid;

  const busy = phase === "building" || phase === "signing" || phase === "submitting";

  const handleSend = async () => {
    if (!wallet.address || !canSubmit) return;
    setError("");
    try {
      setPhase("building");
      const xdr = await buildPaymentXdr(
        wallet.address,
        destination.trim(),
        amountNum.toFixed(7)
      );

      setPhase("signing");
      const signed = await wallet.sign(xdr);

      setPhase("submitting");
      const txHash = await submitPayment(signed);

      setHash(txHash);
      setPhase("success");
      onSuccess({
        id: txHash,
        hash: txHash,
        direction: "out",
        counterparty: destination.trim(),
        amount: amountNum.toFixed(7),
        time: Date.now(),
      });
    } catch (err) {
      setError(readableError(err));
      setPhase("error");
    }
  };

  const busyLabel =
    phase === "building"
      ? "Building transaction…"
      : phase === "signing"
      ? "Waiting for your signature in your wallet…"
      : "Submitting to the network…";

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="modal">
        {(phase === "form" || phase === "error") && (
          <>
            <h3>Send a payment</h3>
            <p>Send XLM from your connected wallet on Stellar testnet. Settles in seconds.</p>

            {prefill?.label && <div className="request-context">{prefill.label}</div>}

            <div className="field">
              <label>Destination address</label>
              <input
                className={destValid ? "" : "error"}
                placeholder="G…"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                spellCheck={false}
              />
              {!destValid && <div className="hint">That doesn't look like a valid Stellar address.</div>}
            </div>

            <div className="field">
              <label>Amount (XLM)</label>
              <input
                className={amountValid ? "" : "error"}
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {!amountValid && <div className="hint">Amount must be a positive number.</div>}
            </div>

            {phase === "error" && <div className="modal-error">{error}</div>}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10 }}
              disabled={!canSubmit}
              onClick={handleSend}
            >
              {phase === "error" ? "Try again" : "Send payment"}
            </button>
            <button className="modal-close" onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {busy && (
          <>
            <div className="spinner" />
            <h3>Sending…</h3>
            <p>{busyLabel}</p>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="success-check">
              <Check />
            </div>
            <h3>Payment settled</h3>
            <p>{Number(amount).toFixed(2)} XLM is on its way. It's already confirmed on-chain.</p>
            <div className="modal-result">{hash}</div>
            <a
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10 }}
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
            >
              View on Stellar Expert
            </a>
            <button className="modal-close" onClick={onClose}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
