import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, config, explorerTxUrl } from "./stellar";

export interface OnChainRequest {
  id: number;
  merchant: string;
  amount: string; // XLM (stroops / 1e7)
  memo: string;
  paid: boolean;
}

export interface ContractEventRecord {
  id: string;
  kind: "created" | "paid";
  requestId: number;
  merchant: string;
  amount?: string;
  ledger: number;
  time: number;
  txHash: string;
}

const STROOPS = 10_000_000n;

function requireContract(): string {
  if (!config.contractId) {
    throw new Error(
      "Contract not configured. Set VITE_CONTRACT_ID after deploying tabclear-requests."
    );
  }
  return config.contractId;
}

/** stroops (i128 on-chain) -> XLM string */
function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS;
  const frac = (stroops % STROOPS).toString().padStart(7, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** XLM string -> stroops (i128) */
function xlmToStroops(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS + BigInt(fracPadded || "0");
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

/** Read a request by id via simulation (no signature, no fee). */
export async function getRequest(
  source: string,
  id: number
): Promise<OnChainRequest> {
  const args = [StellarSdk.nativeToScVal(id, { type: "u32" })];
  const account = await rpc.getAccount(source);
  const contract = new StellarSdk.Contract(requireContract());
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call("get_request", ...args))
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(readContractError(sim.error));
  }
  const raw = sim.result?.retval;
  if (!raw) throw new Error("Request not found.");
  const native = StellarSdk.scValToNative(raw) as {
    merchant: string;
    amount: bigint;
    memo: string;
    paid: boolean;
  };
  return {
    id,
    merchant: native.merchant,
    amount: stroopsToXlm(BigInt(native.amount)),
    memo: native.memo,
    paid: native.paid,
  };
}

/** Poll recent contract events (created/paid) from RPC, newest-first. */
export async function getContractEvents(
  fromLedger?: number
): Promise<ContractEventRecord[]> {
  const contractId = requireContract();
  const latest = await rpc.getLatestLedger();
  const start = fromLedger ?? Math.max(latest.sequence - 8000, 1);

  const res = await rpc.getEvents({
    startLedger: start,
    filters: [{ type: "contract", contractIds: [contractId] }],
  });

  const records: ContractEventRecord[] = [];
  for (const ev of res.events) {
    const topics = ev.topic.map((t) => StellarSdk.scValToNative(t));
    const kind = topics[0] as string;
    if (kind !== "created" && kind !== "paid") continue;
    const merchant = String(topics[1] ?? "");
    const value = StellarSdk.scValToNative(ev.value);

    if (kind === "created") {
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
    } else {
      records.push({
        id: ev.id,
        kind,
        requestId: Number(value),
        merchant,
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

/** Map a contract error scval / message to something readable. */
function readContractError(err: unknown): string {
  const msg = typeof err === "string" ? err : JSON.stringify(err);
  if (/#2\b|AlreadyPaid|Error\(Contract, #2\)/.test(msg)) {
    return "This request is already marked as paid.";
  }
  if (/#1\b|NotFound|Error\(Contract, #1\)/.test(msg)) {
    return "That request doesn't exist.";
  }
  if (/#3\b|InvalidAmount|Error\(Contract, #3\)/.test(msg)) {
    return "Amount must be greater than zero.";
  }
  return `Contract call failed: ${msg}`;
}
