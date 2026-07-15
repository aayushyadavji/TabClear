export interface TxRecord {
  id: string;
  hash: string;
  direction: "in" | "out";
  counterparty: string; // address
  amount: string; // XLM
  memo?: string;
  time: number; // epoch ms
}
