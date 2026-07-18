// Pure, dependency-free conversion + error helpers. Kept separate so they can
// be unit-tested without pulling in the Stellar SDK / network layer.

export const STROOPS = 10_000_000n;

/** stroops (i128 on-chain) -> XLM string, trailing zeros trimmed. */
export function stroopsToXlm(stroops: bigint): string {
  const neg = stroops < 0n;
  const abs = neg ? -stroops : stroops;
  const whole = abs / STROOPS;
  const frac = (abs % STROOPS).toString().padStart(7, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

/** XLM string -> stroops (i128). Accepts up to 7 decimal places. */
export function xlmToStroops(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS + BigInt(fracPadded || "0");
}

/** Map a contract error scval / message to human-readable copy. */
export function readContractError(err: unknown): string {
  const msg = typeof err === "string" ? err : JSON.stringify(err);
  if (/#2\b|AlreadyPaid|Error\(Contract, #2\)/.test(msg)) {
    return "This request is already marked as paid.";
  }
  if (/#1\b|NotFound|Error\(Contract, #1\)/.test(msg)) {
    return "That request doesn't exist.";
  }
  if (/#3\b|InvalidAmount|RequestNotOpen|Error\(Contract, #3\)/.test(msg)) {
    return "This request can't be paid — it's already settled, cancelled, or the amount is invalid.";
  }
  if (/#4\b|Unauthorized|Error\(Contract, #4\)/.test(msg)) {
    return "You're not authorized to perform this action.";
  }
  if (/#5\b|Cancelled|Error\(Contract, #5\)/.test(msg)) {
    return "This request has been cancelled.";
  }
  if (/#6\b|NotInitialized|Error\(Contract, #6\)/.test(msg)) {
    return "The contract isn't initialized yet.";
  }
  return `Contract call failed: ${msg}`;
}

/** Encode a request as a scannable QR payload. */
export function encodeRequestPayload(
  contractId: string,
  id: number,
  amount: string,
  merchant: string
): string {
  return JSON.stringify({ c: contractId, id, amount, m: merchant });
}

export interface DecodedRequestPayload {
  contractId: string;
  id: number;
  amount: string;
  merchant: string;
}

/** Decode a QR payload back into its fields; throws on malformed input. */
export function decodeRequestPayload(raw: string): DecodedRequestPayload {
  const obj = JSON.parse(raw) as { c?: string; id?: number; amount?: string; m?: string };
  if (obj.c == null || obj.id == null || obj.amount == null || obj.m == null) {
    throw new Error("Malformed request payload.");
  }
  return { contractId: obj.c, id: Number(obj.id), amount: obj.amount, merchant: obj.m };
}
