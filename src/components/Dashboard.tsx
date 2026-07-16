import { useState, useEffect, useRef } from "react";
import type { WalletState } from "../hooks/useWallet";
import type { TxRecord } from "../types";
import {
  getXlmBalance,
  accountExists,
  fundWithFriendbot,
  getPaymentHistory,
  shortAddress,
  explorerTxUrl,
  explorerContractUrl,
  readableError,
  config,
} from "../lib/stellar";
import { Copy, Logout, Chevron, Refresh, SendIcon, CashOut, Inbox } from "./icons";
import { SendModal } from "./SendModal";
import { CashoutModal } from "./CashoutModal";
import { RequestsPanel } from "./RequestsPanel";
import { markPaid } from "../lib/contract";

interface Props {
  wallet: WalletState;
  onBackToLanding: () => void;
  toast: (msg: string, variant?: "default" | "error") => void;
}

type View = "Overview" | "Transactions" | "Requests" | "Cash out" | "Settings";
const SIDEBAR_ITEMS: View[] = ["Overview", "Transactions", "Requests", "Cash out", "Settings"];

export function Dashboard({ wallet, onBackToLanding, toast }: Props) {
  const [balance, setBalance] = useState<string | null>(null);
  const [funded, setFunded] = useState<boolean | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [funding, setFunding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendPrefill, setSendPrefill] = useState<
    { destination: string; amount: string; label: string; requestId?: number } | undefined
  >(undefined);
  const [showCashout, setShowCashout] = useState(false);
  const [txs, setTxs] = useState<TxRecord[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const menuRef = useRef<HTMLDivElement>(null);

  const addr = wallet.address ?? "";
  const wrongNetwork =
    wallet.network != null && wallet.network.toUpperCase() !== "TESTNET";

  async function refreshBalance() {
    if (!addr) return;
    setLoadingBalance(true);
    try {
      const exists = await accountExists(addr);
      setFunded(exists);
      setBalance(exists ? await getXlmBalance(addr) : "0");
    } catch (err) {
      toast(readableError(err), "error");
    } finally {
      setLoadingBalance(false);
    }
  }

  async function refreshTxs() {
    if (!addr) return;
    setLoadingTxs(true);
    try {
      const history = await getPaymentHistory(addr);
      // Merge on-chain history with anything sent this session, de-duped by hash.
      setTxs((session) => {
        const byId = new Map<string, TxRecord>();
        for (const tx of history) byId.set(tx.id, tx);
        for (const tx of session) if (!byId.has(tx.id)) byId.set(tx.id, tx);
        return [...byId.values()].sort((a, b) => b.time - a.time);
      });
    } catch (err) {
      toast(readableError(err), "error");
    } finally {
      setLoadingTxs(false);
    }
  }

  useEffect(() => {
    refreshBalance();
    refreshTxs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleFund() {
    if (!addr) return;
    setFunding(true);
    try {
      await fundWithFriendbot(addr);
      toast("Account funded with testnet XLM");
      await refreshBalance();
      await refreshTxs();
    } catch (err) {
      toast(readableError(err), "error");
    } finally {
      setFunding(false);
    }
  }

  function copyAddress() {
    navigator.clipboard.writeText(addr);
    toast("Address copied");
    setMenuOpen(false);
  }

  function onPaymentSuccess(tx: TxRecord) {
    setTxs((prev) => [tx, ...prev]);
    // If this payment settled an on-chain request, mark it paid on the contract.
    const requestId = sendPrefill?.requestId;
    if (requestId != null && wallet.address) {
      toast("Payment sent — marking the request paid on-chain…");
      markPaid(wallet.address, requestId, wallet.sign)
        .then(() => toast("Request marked paid on-chain"))
        .catch((err) => toast(readableError(err), "error"));
    } else {
      toast("Payment settled instantly");
    }
    setTimeout(() => {
      refreshBalance();
      refreshTxs();
    }, 1500);
  }

  function openSend() {
    setSendPrefill(undefined);
    setShowSend(true);
  }

  function payRequest(p: { destination: string; amount: string; label: string; requestId: number }) {
    setSendPrefill(p);
    setShowSend(true);
  }

  function selectView(item: View) {
    if (item === "Cash out") {
      setShowCashout(true);
      return;
    }
    setView(item);
  }

  const balanceLabel =
    balance == null
      ? "—"
      : `${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XLM`;

  const spark = [38, 52, 30, 61, 44, 70, 48];

  return (
    <div className="dash-shell fade-in">
      <aside className="sidebar">
        <div className="brand" style={{ marginBottom: 24 }}>
          <span className="brand-mark">T</span>Tabclear
        </div>
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item}
            className={`sb-item${item === view ? " active" : ""}`}
            onClick={() => selectView(item)}
          >
            <span className="sb-dot" />
            {item}
          </button>
        ))}
      </aside>

      <main className="dash-main">
        <div className="dash-topbar">
          <div className="dash-greet">
            <div className="label">Merchant till · testnet</div>
            <h1>{view === "Overview" ? "Your Stall" : view}</h1>
          </div>

          <div className={`wallet-menu${menuOpen ? " open" : ""}`} ref={menuRef}>
            <button className="merchant-chip" onClick={() => setMenuOpen((o) => !o)}>
              <span className="avatar" />
              {shortAddress(addr)}
              <Chevron className="chev" />
            </button>
            <div className="wallet-dropdown">
              <div className="wd-header">
                <div className="wd-name">Connected wallet</div>
                <div className="wd-addr">{shortAddress(addr)}</div>
              </div>
              <button className="wd-item" onClick={copyAddress}>
                <Copy />
                Copy address
              </button>
              <button className="wd-item danger" onClick={onBackToLanding}>
                <Logout />
                Disconnect wallet
              </button>
            </div>
          </div>
        </div>

        {wrongNetwork && (
          <div className="panel" style={{ borderColor: "var(--rust)", marginBottom: 22 }}>
            <strong>Freighter is on {wallet.network}.</strong> Switch it to <strong>Testnet</strong> to use Tabclear.
          </div>
        )}

        {view === "Overview" && (
          <>
            <div className="grid-2">
              <div className="balance-card">
                <div className="label">Available now</div>
                <div className="balance-num mono">{loadingBalance && balance == null ? "…" : balanceLabel}</div>
                {funded === false && <div className="balance-sub">Account not funded yet — grab free testnet XLM below.</div>}
                <div className="balance-actions">
                  {funded === false ? (
                    <button className="btn btn-light" onClick={handleFund} disabled={funding}>
                      {funding ? "Funding…" : "Fund with Friendbot"}
                    </button>
                  ) : (
                    <button className="btn btn-light" onClick={openSend}>
                      <SendIcon />
                      Send payment
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => setShowCashout(true)}>
                    <CashOut />
                    Cash out
                  </button>
                  <button className="btn btn-ghost" onClick={refreshBalance} disabled={loadingBalance}>
                    <Refresh />
                    {loadingBalance ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="stat-card">
                <div>
                  <div className="label">Today's sales</div>
                  <div className="stat-num">{txs.length}</div>
                  <div className="stat-note">↑ settling instantly</div>
                </div>
                <div className="sparkline">
                  {spark.map((h, i) => (
                    <div key={i} className="spark-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            <ActivityPanel txs={txs} funded={funded} loading={loadingTxs} onNew={openSend} onRefresh={refreshTxs} />
          </>
        )}

        {view === "Transactions" && (
          <ActivityPanel txs={txs} funded={funded} loading={loadingTxs} onNew={openSend} onRefresh={refreshTxs} full />
        )}

        {view === "Requests" && (
          <RequestsPanel wallet={wallet} toast={toast} onPay={payRequest} />
        )}

        {view === "Settings" && (
          <div className="panel">
            <div className="panel-head">
              <h2>Settings</h2>
            </div>
            <div className="settings-list">
              <SettingRow label="Connected address" value={addr || "—"} mono onCopy={copyAddress} />
              <SettingRow label="Wallet" value={wallet.walletName ?? "—"} />
              <SettingRow label="Network" value={wallet.network ?? "unknown"} />
              <SettingRow label="Horizon endpoint" value={config.horizonUrl} mono />
              <SettingRow label="Soroban RPC" value={config.rpcUrl} mono />
              <SettingRow
                label="Requests contract"
                value={config.contractId || "not configured"}
                mono
                href={config.contractId ? explorerContractUrl(config.contractId) : undefined}
              />
              <SettingRow
                label="Explorer"
                value="Stellar Expert (testnet)"
                href={config.explorerBase}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-outline" onClick={onBackToLanding}>
                <Logout />
                Disconnect wallet
              </button>
            </div>
          </div>
        )}
      </main>

      {showSend && wallet.address && (
        <SendModal
          wallet={wallet}
          prefill={sendPrefill}
          onClose={() => setShowSend(false)}
          onSuccess={onPaymentSuccess}
        />
      )}
      {showCashout && (
        <CashoutModal
          balanceLabel={balanceLabel}
          onClose={() => setShowCashout(false)}
          onConfirm={() => toast("Cash-out requested (demo)")}
        />
      )}
    </div>
  );
}

function ActivityPanel({
  txs,
  funded,
  loading,
  onNew,
  onRefresh,
  full,
}: {
  txs: TxRecord[];
  funded: boolean | null;
  loading: boolean;
  onNew: () => void;
  onRefresh: () => void;
  full?: boolean;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{full ? "All transactions" : "Recent activity"}</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button className="link-btn" onClick={onRefresh} disabled={loading}>
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
          {funded !== false && (
            <button className="link-btn" onClick={onNew}>
              + New payment
            </button>
          )}
        </div>
      </div>

      {txs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Inbox />
          </div>
          <p>{loading ? "Loading transaction history…" : "No payments yet. Send one to see it settle here instantly."}</p>
        </div>
      ) : (
        <div>
          {txs.map((tx) => (
            <div key={tx.id} className="tx-row new">
              <div className={`tx-icon${tx.direction === "out" ? " out" : ""}`}>
                {tx.direction === "out" ? "↑" : "↓"}
              </div>
              <div>
                <div className="tx-name">
                  {tx.direction === "out" ? "Sent to" : "Received from"} {shortAddress(tx.counterparty)}
                </div>
                <div className="tx-time">
                  {new Date(tx.time).toLocaleTimeString()} ·{" "}
                  <a className="tx-link" href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
                    View tx
                  </a>
                </div>
              </div>
              <div className={`tx-amt${tx.direction === "out" ? " out" : ""}`}>
                {tx.direction === "out" ? "−" : "+"}
                {Number(tx.amount).toFixed(2)}
              </div>
              <div className="tx-status">Settled</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingRow({
  label,
  value,
  mono,
  href,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  href?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <span className="setting-value">
        {href ? (
          <a className="tx-link" href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          <span className={mono ? "mono" : ""}>{value}</span>
        )}
        {onCopy && (
          <button className="link-btn" onClick={onCopy} style={{ marginLeft: 8 }}>
            Copy
          </button>
        )}
      </span>
    </div>
  );
}
