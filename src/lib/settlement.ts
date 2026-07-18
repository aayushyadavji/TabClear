import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, config } from "./stellar";
import { readContractError } from "./format";

function requireSettlement(): string {
  if (!config.settlementId) {
    throw new Error(
      "Settlement contract not configured. Set VITE_SETTLEMENT_ID to enable one-tx atomic pay."
    );
  }
  return config.settlementId;
}

export function isSettlementConfigured(): boolean {
  return !!config.settlementId;
}

/**
 * Atomically pay a request in ONE transaction via tabclear-settlement:
 * cross-contract read of the request, XLM transfer payer->merchant through the
 * native SAC, and cross-contract settle — all-or-nothing. Returns the tx hash.
 */
export async function payRequest(
  source: string,
  id: number,
  sign: (xdr: string) => Promise<string>
): Promise<{ hash: string }> {
  const account = await rpc.getAccount(source);
  const contract = new StellarSdk.Contract(requireSettlement());

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      contract.call(
        "pay_request",
        StellarSdk.nativeToScVal(id, { type: "u32" }),
        StellarSdk.Address.fromString(source).toScVal()
      )
    )
    .setTimeout(180)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(readContractError(sim.error));
  }
  const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();

  const signedXdr = await sign(prepared.toXDR());
  const signed = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const sent = await rpc.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(readContractError(JSON.stringify(sent.errorResult)));
  }

  let got = await rpc.getTransaction(sent.hash);
  while (got.status === "NOT_FOUND") {
    await new Promise((r) => setTimeout(r, 1000));
    got = await rpc.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`Atomic settlement failed: ${got.status}`);
  }
  return { hash: sent.hash };
}
