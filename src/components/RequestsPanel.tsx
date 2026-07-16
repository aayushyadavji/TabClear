import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { WalletState } from "../hooks/useWallet";
import {
  createRequest,
  getRequest,
  getContractEvents,
  type OnChainRequest,
  type ContractEventRecord,
} from "../lib/contract";
import { config, readableError, shortAddress, explorerTxUrl } from "../lib/stellar";
import { QrIcon } from "./icons";

interface Props {
  wallet: WalletState;
  toast: (msg: string, variant?: "default" | "error") => void;
  onPay: (p: { destination: string; amount: string; label: string; requestId: number }) => void;
}

type Status = "pending" | "success" | "failed";

interface LocalRequest {
  id: number;
  amount: string;
  memo: string;
  hash: string;
  status: Status;
  paid: boolean;
}

/** Encode a request as a scannable payload the customer can paste/scan. */
function encodeRequest(id: number, amount: string, merchant: string): string {
  return JSON.stringify({ c: config.contractId, id, amount, m: merchant });
}

export function RequestsPanel({ wallet, toast, onPay }: Props) {
  const configured = !!config.contractId;
  const addr = wallet.address ?? "";

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [created, setCreated] = useState<LocalRequest[]>([]);
  const [events, setEvents] = useState<ContractEventRecord[]>([]);

  const [payId, setPayId] = useState("");
  const [looking, setLooking] = useState(false);

  const amountNum = Number(amount);
  const canCreate =
    configured && !!addr && amount.trim() !== "" && amountNum > 0 && Number.isFinite(amountNum);

  const refreshEvents = useCallback(async () => {
    if (!configured) return;
    try {
      setEvents(await getContractEvents());
    } catch {
      // Non-fatal — events are a live overlay, not the source of truth.
    }
  }, [configured]);

  useEffect(() => {
    refreshEvents();
    if (!configured) return;
    const t = setInterval(refreshEvents, 6000);
    return () => clearInterval(t);
  }, [configured, refreshEvents]);

  async function handleCreate() {
    if (!canCreate || !addr) return;
    setCreating(true);
    setStatus("pending");
    try {
      const { id, hash } = await createRequest(addr, amountNum.toFixed(7), memo.trim(), wallet.sign);
      setStatus("success");
      setCreated((prev) => [
        { id, amount: amountNum.toFixed(7), memo: memo.trim(), hash, status: "success", paid: false },
        ...prev,
      ]);
      setAmount("");
      setMemo("");
      toast(`Request #${id} created on-chain`);
      refreshEvents();
    } catch (err) {
      setStatus("failed");
      toast(readableError(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleLookup() {
    if (!addr || payId.trim() === "") return;
    setLooking(true);
    try {
      const id = Number(payId.trim());
      const req: OnChainRequest = await getRequest(addr, id);
      if (req.paid) {
        toast(`Request #${id} is already paid.`, "error");
        return;
      }
      onPay({
        destination: req.merchant,
        amount: req.amount,
        label: `Paying request #${id}${req.memo ? ` · ${req.memo}` : ""}`,
        requestId: id,
      });
    } catch (err) {
      toast(readableError(err), "error");
    } finally {
      setLooking(false);
    }
  }

  if (!configured) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>Payment requests</h2>
        </div>
        <div className="empty-state">
          <div className="empty-icon">
            <QrIcon />
          </div>
          <p>
            The requests contract isn't configured yet. Deploy{" "}
            <strong>tabclear-requests</strong> and set <code>VITE_CONTRACT_ID</code> to enable
            on-chain QR payment requests.
          </p>
        </div>
      </div>
    );
  }

  const latest = created[0];

  return (
    <div className="requests-grid">
      <div className="panel">
        <div className="panel-head">
          <h2>Create a request</h2>
          {status && <StatusPill status={status} />}
        </div>

        <div className="field">
          <label>Amount (XLM)</label>
          <input
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Memo (optional)</label>
          <input
            placeholder="Table 4 · flat white"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} disabled={!canCreate || creating} onClick={handleCreate}>
          {creating ? "Creating on-chain…" : "Create request"}
        </button>

        {latest && (
          <div className="qr-card">
            <QRCodeSVG
              value={encodeRequest(latest.id, latest.amount, addr)}
              size={168}
              bgColor="transparent"
              fgColor="#2f3d2a"
              level="M"
            />
            <div className="qr-meta">
              <div className="qr-id">Request #{latest.id}</div>
              <div className="qr-amt mono">{Number(latest.amount).toFixed(2)} XLM</div>
              {latest.memo && <div className="qr-memo">{latest.memo}</div>}
              <a className="tx-link" href={explorerTxUrl(latest.hash)} target="_blank" rel="noreferrer">
                View creation tx
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Pay a request</h2>
        </div>
        <p className="muted">Enter a request id (from a QR) to pay the merchant and settle it on-chain.</p>
        <div className="field">
          <label>Request id</label>
          <input
            placeholder="1"
            inputMode="numeric"
            value={payId}
            onChange={(e) => setPayId(e.target.value)}
          />
        </div>
        <button className="btn btn-light" style={{ width: "100%" }} disabled={looking || payId.trim() === ""} onClick={handleLookup}>
          {looking ? "Looking up…" : "Look up & pay"}
        </button>

        <div className="panel-head" style={{ marginTop: 26 }}>
          <h2>Live contract events</h2>
          <button className="link-btn" onClick={refreshEvents}>↻ Refresh</button>
        </div>
        {events.length === 0 ? (
          <div className="empty-state">
            <p>No contract events yet. Create or pay a request to see them stream here.</p>
          </div>
        ) : (
          <div>
            {events.map((ev) => (
              <div key={ev.id} className="tx-row new">
                <div className={`tx-icon${ev.kind === "paid" ? "" : " out"}`}>
                  {ev.kind === "paid" ? "✓" : "＋"}
                </div>
                <div>
                  <div className="tx-name">
                    {ev.kind === "created" ? "Request created" : "Request paid"} · #{ev.requestId}
                  </div>
                  <div className="tx-time">
                    {shortAddress(ev.merchant)} ·{" "}
                    <a className="tx-link" href={explorerTxUrl(ev.txHash)} target="_blank" rel="noreferrer">
                      View tx
                    </a>
                  </div>
                </div>
                <StatusPill status={ev.kind === "paid" ? "success" : "pending"} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const label = status === "pending" ? "Pending" : status === "success" ? "Success" : "Failed";
  return <span className={`status-pill ${status}`}>{label}</span>;
}
