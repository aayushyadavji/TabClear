import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import { config } from "../lib/stellar";

export interface FreighterState {
  connected: boolean;
  address: string | null;
  network: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sign: (xdr: string) => Promise<string>;
}

export function useFreighter(): FreighterState {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Silent restore: if the app was already granted access, pick the session back up.
  useEffect(() => {
    (async () => {
      const { isConnected: installed, error } = await isConnected();
      if (error || !installed) return;

      const { address: addr, error: addrErr } = await getAddress();
      if (addrErr || !addr) return; // "" until access granted

      const { network: net } = await getNetwork();
      setConnected(true);
      setAddress(addr);
      setNetwork(net ?? null);
    })();
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { isConnected: installed, error } = await isConnected();
      if (error || !installed) {
        throw new Error(
          "Freighter isn't installed. Get it at freighter.app, then reload."
        );
      }

      const { address: addr, error: accessError } = await requestAccess();
      if (accessError) throw new Error(accessError.message ?? String(accessError));
      if (!addr) throw new Error("No address returned from Freighter.");

      const { network: net } = await getNetwork();
      setConnected(true);
      setAddress(addr);
      setNetwork(net ?? null);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Freighter has no programmatic disconnect — we clear our own session.
    setConnected(false);
    setAddress(null);
    setNetwork(null);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Wallet not connected.");
      const { signedTxXdr, error } = await signTransaction(xdr, {
        networkPassphrase: config.networkPassphrase,
        address,
      });
      if (error) throw new Error(error.message ?? String(error));
      return signedTxXdr;
    },
    [address]
  );

  return { connected, address, network, connecting, connect, disconnect, sign };
}
