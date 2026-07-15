import * as StellarSdk from "@stellar/stellar-sdk";

// White Belt targets Stellar Testnet only.
export const config = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: StellarSdk.Networks.TESTNET,
  friendbotUrl: "https://friendbot.stellar.org",
  explorerBase: "https://stellar.expert/explorer/testnet",
};

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);

export function explorerTxUrl(hash: string): string {
  return `${config.explorerBase}/tx/${hash}`;
}

export function shortAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/** Fetch the native (XLM) balance for an account. Returns "0" if unfunded. */
export async function getXlmBalance(address: string): Promise<string> {
  try {
    const account = await horizon.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native?.balance ?? "0";
  } catch (err: unknown) {
    if (isNotFound(err)) return "0";
    throw err;
  }
}

/** True if the account exists on-chain (has been funded). */
export async function accountExists(address: string): Promise<boolean> {
  try {
    await horizon.loadAccount(address);
    return true;
  } catch (err: unknown) {
    if (isNotFound(err)) return false;
    throw err;
  }
}

/** Fund a testnet account via Friendbot. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const res = await fetch(`${config.friendbotUrl}/?addr=${encodeURIComponent(address)}`);
  if (!res.ok) {
    throw new Error("Friendbot funding failed — the account may already be funded.");
  }
}

/**
 * Fetch recent XLM payment history for an account from Horizon.
 * Returns newest-first, native payments only (includes account-create funding).
 */
export async function getPaymentHistory(
  address: string,
  limit = 20
): Promise<import("../types").TxRecord[]> {
  try {
    const page = await horizon
      .payments()
      .forAccount(address)
      .order("desc")
      .limit(limit)
      .call();

    const records: import("../types").TxRecord[] = [];
    for (const op of page.records) {
      if (op.type === "payment") {
        if (op.asset_type !== "native") continue;
        const outgoing = op.from === address;
        records.push({
          id: op.id,
          hash: op.transaction_hash,
          direction: outgoing ? "out" : "in",
          counterparty: outgoing ? op.to : op.from,
          amount: op.amount,
          time: new Date(op.created_at).getTime(),
        });
      } else if (op.type === "create_account") {
        // The funding payment that created this (or another) account.
        const outgoing = op.funder === address;
        records.push({
          id: op.id,
          hash: op.transaction_hash,
          direction: outgoing ? "out" : "in",
          counterparty: outgoing ? op.account : op.funder,
          amount: op.starting_balance,
          time: new Date(op.created_at).getTime(),
        });
      }
    }
    return records;
  } catch (err: unknown) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

/**
 * Build an unsigned XLM payment transaction (as XDR) from source to destination.
 * Validates the destination and that the source account exists.
 */
export async function buildPaymentXdr(
  source: string,
  destination: string,
  amount: string
): Promise<string> {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error("Destination is not a valid Stellar address.");
  }

  const account = await horizon.loadAccount(source);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination,
        asset: StellarSdk.Asset.native(),
        amount,
      })
    )
    .setTimeout(180)
    .build();

  return tx.toXDR();
}

/** Submit a signed classic transaction via Horizon; returns the tx hash. */
export async function submitPayment(signedXdr: string): Promise<string> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );
  const res = await horizon.submitTransaction(tx as StellarSdk.Transaction);
  return res.hash;
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  );
}

/** Turn Horizon/SDK errors into a human-readable message. */
export function readableError(err: unknown): string {
  if (isNotFound(err)) {
    return "Account not found on testnet — fund it with Friendbot first.";
  }
  const resultCodes = (
    err as {
      response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } };
    }
  )?.response?.data?.extras?.result_codes;
  if (resultCodes) {
    if (resultCodes.operations?.includes("op_underfunded")) {
      return "Insufficient balance to cover this payment plus the fee.";
    }
    if (resultCodes.operations?.includes("op_no_destination")) {
      return "Destination account doesn't exist yet on testnet.";
    }
    return `Transaction failed: ${resultCodes.transaction ?? "unknown error"}.`;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
