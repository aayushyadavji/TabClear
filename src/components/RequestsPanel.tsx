import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { WalletState } from "../hooks/useWallet";
import {
  createRequest,
  getRequest,
  listRequests,
  getContractEvents,
  type OnChainRequest,
  type ContractEventRecord,
} from "../lib/contract";
import { payRequest, isSettlementConfigured } from "../lib/settlement";
import { encodeRequestPayload } from "../lib/format";
import { config, readableError, shortAddress, explorerTxUrl } from "../lib/stellar";
import { QrIcon } from "./icons";

interface Props {
  wallet: WalletState;
  toast: (msg: string, variant?: "default" | "error") => void;
  // Fallback two-step pay path (used when the settlement contract isn't configured).
  onPay: (p: { destination: string; amount: string; label: string; requestId: number }) => void;
}

type Status = "pending" | "success" | "failed";

interface LocalRequest {
  id: number;
  amount: string;
  memo: string;
  hash: string;
  status: Status;
}

export function RequestsPanel({ wallet, toast, onPay }: Props) {
  const configured = !!config.contractId;
  const atomic = isSettlementConfigured();
  const addr = wallet.address ?? "";

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [created, setCreated] = useState<LocalRequest[]>([]);
  const [events, setEvents] = useState<ContractEventRecord[]>([]);
  const [requests, setRequests] = useState<OnChainRequest[]>([]);

  const [payId, setPayId] = useState("");
  const [paying, setPaying] = useState(false);

  const amountNum = Number(amount);
  const canCreate =
    configured && !!addr && amount.trim() !== "" && amountNum > 0 && Number.isFinite(amountNum);

  const refreshFeed = useCallback(async () => {
    if (!configured || !addr) return;
    try {
      const [evs, reqs] = await Promise.all([
        getContractEvents(),
        listRequests(addr, 0, 20).catch(() => [] as OnChainRequest[]),
      ]);
      setEvents((prev) => {
        // Toast on any newly-seen settled event.
        const seen = new Set(prev.map((e) => e.id));
        for (const e of evs) {
          if (e.kind === "settled" && !seen.has(e.id)) {
            toast(`💰 Request #${e.requestId} was just paid`);
          }
        }
        return evs;
      });
      setRequests(reqs);
    } catch {
      // Non-fatal — the feed is a live overlay, not the source of truth.
    }
  }, [configured, addr, toast]);

  useEffect(() => {
    refreshFeed();
    if (!configured) return;
    const t = setInterval(refreshFeed, 6000);
    return () => clearInterval(t);
  }, [configured, refreshFeed]);

  async function handleCreate() {
    if (!canCreate || !addr) return;
    setCreating(true);
    setStatus("pending");
    try {
      const { id, hash } = await createRequest(addr, amountNum.toFixed(7), memo.trim(), wallet.sign);
      setStatus("success");
      setCreated((prev) => [
        { id, amount: amountNum.toFixed(7), memo: memo.trim(), hash, status: "success" },
        ...prev,
      ]);
      setAmount("");
      setMemo("");
      toast(`Request #${id} created on-chain`);
      refreshFeed();
    } catch (err) {
      setStatus("failed");
      toast(readableError(err), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handlePay() {
    if (!addr || payId.trim() === "") return;
    setPaying(true);
    try {
      const id = Number(payId.trim());
      const req = await getRequest(addr, id);
      if (req.paid) {
        toast(`Request #${id} is already paid.`, "error");
        return;
      }
      if (req.cancelled) {
        toast(`Request #${id} was cancelled.`, "error");
        return;
      }

      if (atomic) {
        // Orange Belt: one transaction — transfer + settle atomically.
        toast(`Paying request #${id} in one atomic transaction…`);
        const { hash } = await payRequest(addr, id, wallet.sign);
        toast(`Request #${id} settled on-chain in one tx`);
        setPayId("");
        setCreated((prev) => [
          { id, amount: req.amount, memo: req.memo, hash, status: "success" },
          ...prev.filter((r) => r.id !== id),
        ]);
        refreshFeed();
      } else {
        // Fallback: two-step (Horizon payment then mark_paid via the parent).
        onPay({
          destination: req.merchant,
          amount: req.amount,
          label: `Paying request #${id}${req.memo ? ` · ${req.memo}` : ""}`,
          requestId: id,
        });
      }
    } catch (err) {
      toast(readableError(err), "error");
    } finally {
      setPaying(false);
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
            <strong>tabclear-requests</strong> and set <code>VITE_REQUESTS_ID</code> to enable
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
              value={encodeRequestPayload(config.contractId, latest.id, latest.amount, addr)}
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
                View tx
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Pay a request</h2>
          {atomic && <span className="status-pill success">Atomic · 1 tx</span>}
        </div>
        <p className="muted">
          {atomic
            ? "Enter a request id (from a QR). One signed transaction moves XLM to the merchant and settles the request on-chain — atomically."
            : "Enter a request id (from a QR) to pay the merchant. Set VITE_SETTLEMENT_ID for one-tx atomic settlement."}
        </p>
        <div className="field">
          <label>Request id</label>
          <input
            placeholder="1"
            inputMode="numeric"
            value={payId}
            onChange={(e) => setPayId(e.target.value)}
          />
        </div>
        <button className="btn btn-light" style={{ width: "100%" }} disabled={paying || payId.trim() === ""} onClick={handlePay}>
          {paying ? "Settling…" : atomic ? "Pay atomically (1 tx)" : "Look up & pay"}
        </button>

        {requests.length > 0 && (
          <>
            <div className="panel-head" style={{ marginTop: 26 }}>
              <h2>Requests</h2>
            </div>
            <div>
              {requests.map((r) => (
                <div key={r.id} className="tx-row">
                  <div className={`tx-icon${r.status === "Paid" ? "" : " out"}`}>#{r.id}</div>
                  <div>
                    <div className="tx-name">
                      {Number(r.amount).toFixed(2)} XLM{r.memo ? ` · ${r.memo}` : ""}
                    </div>
                    <div className="tx-time">{shortAddress(r.merchant)}</div>
                  </div>
                  <StatusPill status={r.status === "Paid" ? "success" : r.status === "Cancelled" ? "failed" : "pending"} />
                </div>
              ))}
            </div>
          </>
        )}

        <div className="panel-head" style={{ marginTop: 26 }}>
          <h2>Live contract events</h2>
          <button className="link-btn" onClick={refreshFeed}>↻ Refresh</button>
        </div>
        {events.length === 0 ? (
          <div className="empty-state">
            <p>No contract events yet. Create or pay a request to see them stream here.</p>
          </div>
        ) : (
          <div>
            {events.map((ev) => (
              <div key={ev.id} className="tx-row new">
                <div className={`tx-icon${ev.kind === "created" ? " out" : ""}`}>
                  {ev.kind === "created" ? "＋" : ev.kind === "settled" ? "💰" : "✓"}
                </div>
                <div>
                  <div className="tx-name">
                    {ev.kind === "created"
                      ? "Request created"
                      : ev.kind === "settled"
                      ? "Settled atomically"
                      : "Request paid"}{" "}
                    · #{ev.requestId}
                  </div>
                  <div className="tx-time">
                    {shortAddress(ev.merchant)} ·{" "}
                    <a className="tx-link" href={explorerTxUrl(ev.txHash)} target="_blank" rel="noreferrer">
                      View tx
                    </a>
                  </div>
                </div>
                <StatusPill status={ev.kind === "created" ? "pending" : "success"} />
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
