import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, config, explorerTxUrl } from "./stellar";
import { stroopsToXlm, xlmToStroops, readContractError } from "./format";

export type RequestStatus = "Open" | "Paid" | "Cancelled";

export interface OnChainRequest {
  id: number;
  merchant: string;
  amount: string; // XLM (stroops / 1e7)
  memo: string;
  status: RequestStatus;
  paid: boolean;
  cancelled: boolean;
  paidBy?: string;
}

export interface ContractEventRecord {
  id: string;
  kind: "created" | "paid" | "settled";
  requestId: number;
  merchant: string;
  amount?: string;
  ledger: number;
  time: number;
  txHash: string;
}

function requireContract(): string {
  if (!config.contractId) {
    throw new Error(
      "Contract not configured. Set VITE_REQUESTS_ID after deploying tabclear-requests."
    );
  }
  return config.contractId;
}

async function buildInvoke(
  source: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<StellarSdk.Transaction> {
  const account = await rpc.getAccount(source);
  const contract = new StellarSdk.Contract(requireContract());

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(readContractError(sim.error));
  }
  return StellarSdk.rpc.assembleTransaction(tx, sim).build();
}

async function sendAndConfirm(
  signedXdr: string
): Promise<{ hash: string; returnValue?: StellarSdk.xdr.ScVal }> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const sent = await rpc.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`Contract call rejected: ${JSON.stringify(sent.errorResult)}`);
  }

  let got = await rpc.getTransaction(sent.hash);
  while (got.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    got = await rpc.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`Contract call failed: ${got.status}`);
  }
  return { hash: sent.hash, returnValue: got.returnValue };
}

/** Build + sign + submit create_request. Returns the new request id + tx hash. */
export async function createRequest(
  source: string,
  amountXlm: string,
  memo: string,
  sign: (xdr: string) => Promise<string>
): Promise<{ id: number; hash: string }> {
  const args = [
    StellarSdk.Address.fromString(source).toScVal(),
    StellarSdk.nativeToScVal(xlmToStroops(amountXlm), { type: "i128" }),
    StellarSdk.nativeToScVal(memo, { type: "string" }),
  ];
  const tx = await buildInvoke(source, "create_request", args);
  const signed = await sign(tx.toXDR());
  const { hash, returnValue } = await sendAndConfirm(signed);
  const id = returnValue ? Number(StellarSdk.scValToNative(returnValue)) : 0;
  return { id, hash };
}

/** Build + sign + submit mark_paid. */
export async function markPaid(
  source: string,
  id: number,
  sign: (xdr: string) => Promise<string>
): Promise<{ hash: string }> {
  const args = [StellarSdk.nativeToScVal(id, { type: "u32" })];
  const tx = await buildInvoke(source, "mark_paid", args);
  const signed = await sign(tx.toXDR());
  const { hash } = await sendAndConfirm(signed);
  return { hash };
}

/** Run a read-only contract call via simulation; returns the native return value. */
async function simulateRead(
  source: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<unknown> {
  const account = await rpc.getAccount(source);
  const contract = new StellarSdk.Contract(contractId);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(readContractError(sim.error));
  }
  const raw = sim.result?.retval;
  if (!raw) throw new Error("No value returned from contract.");
  return StellarSdk.scValToNative(raw);
}

interface RawV2Request {
  merchant: string;
  amount: bigint;
  memo: string;
  status: RequestStatus | { tag: RequestStatus };
  paid_by?: string | null;
}

function decodeRequest(id: number, native: RawV2Request): OnChainRequest {
  // scValToNative renders the Status enum as either "Open" or { tag: "Open" }.
  const status = (
    typeof native.status === "string" ? native.status : native.status?.tag
  ) as RequestStatus;
  return {
    id,
    merchant: native.merchant,
    amount: stroopsToXlm(BigInt(native.amount)),
    memo: native.memo,
    status,
    paid: status === "Paid",
    cancelled: status === "Cancelled",
    paidBy: native.paid_by ?? undefined,
  };
}

/** Read a request by id via simulation (no signature, no fee). */
export async function getRequest(
  source: string,
  id: number
): Promise<OnChainRequest> {
  const native = (await simulateRead(source, requireContract(), "get_request", [
    StellarSdk.nativeToScVal(id, { type: "u32" }),
  ])) as RawV2Request;
  return decodeRequest(id, native);
}

/** Newest-first page of on-chain requests (real data, no id guessing). */
export async function listRequests(
  source: string,
  start = 0,
  limit = 20
): Promise<OnChainRequest[]> {
  const native = (await simulateRead(source, requireContract(), "list_requests", [
    StellarSdk.nativeToScVal(start, { type: "u32" }),
    StellarSdk.nativeToScVal(limit, { type: "u32" }),
  ])) as Array<[number, RawV2Request]>;
  return native.map(([id, req]) => decodeRequest(Number(id), req));
}

/** Poll recent contract events (created/paid/settled) from RPC, newest-first. */
export async function getContractEvents(
  fromLedger?: number
): Promise<ContractEventRecord[]> {
  const contractIds = [config.contractId, config.settlementId].filter(Boolean);
  if (contractIds.length === 0) return [];
  const latest = await rpc.getLatestLedger();
  const start = fromLedger ?? Math.max(latest.sequence - 8000, 1);

  const res = await rpc.getEvents({
    startLedger: start,
    filters: [{ type: "contract", contractIds }],
  });

  const records: ContractEventRecord[] = [];
  for (const ev of res.events) {
    const topics = ev.topic.map((t) => StellarSdk.scValToNative(t));
    const kind = topics[0] as string;
    const value = StellarSdk.scValToNative(ev.value);

    if (kind === "created") {
      const merchant = String(topics[1] ?? "");
      const [reqId, amount] = value as [number, bigint];
      records.push({
        id: ev.id,
        kind,
        requestId: Number(reqId),
        merchant,
        amount: stroopsToXlm(BigInt(amount)),
        ledger: ev.ledger,
        time: new Date(ev.ledgerClosedAt).getTime(),
        txHash: ev.txHash,
      });
    } else if (kind === "paid") {
      const merchant = String(topics[1] ?? "");
      records.push({
        id: ev.id,
        kind,
        requestId: Number(value),
        merchant,
        ledger: ev.ledger,
        time: new Date(ev.ledgerClosedAt).getTime(),
        txHash: ev.txHash,
      });
    } else if (kind === "settled") {
      // settlement contract: topics ("settled", id) | data (payer, merchant, amount)
      const [, merchant, amount] = value as [string, string, bigint];
      records.push({
        id: ev.id,
        kind,
        requestId: Number(topics[1] ?? 0),
        merchant: String(merchant ?? ""),
        amount: stroopsToXlm(BigInt(amount)),
        ledger: ev.ledger,
        time: new Date(ev.ledgerClosedAt).getTime(),
        txHash: ev.txHash,
      });
    }
  }
  return records.sort((a, b) => b.time - a.time);
}

export function contractExplorerTxUrl(hash: string): string {
  return explorerTxUrl(hash);
}
