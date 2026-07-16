import { useState, useEffect, useCallback } from "react";
import {
  StellarWalletsKit,
  Networks,
  KitEventType,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { config } from "../lib/stellar";

// One-time kit setup. Testnet, with the four wallets we advertise in the README.
StellarWalletsKit.init({
  network: Networks.TESTNET,
  modules: [
    new FreighterModule(),
    new AlbedoModule(),
    new xBullModule(),
    new LobstrModule(),
  ],
});

const WALLET_KEY = "tabclear:wallet-id";

export interface WalletState {
  connected: boolean;
  address: string | null;
  network: string | null;
  walletName: string | null;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sign: (xdr: string) => Promise<string>;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Silent restore: reuse the previously selected wallet if the user granted access.
  useEffect(() => {
    const savedId = localStorage.getItem(WALLET_KEY);
    if (!savedId) return;
    (async () => {
      try {
        StellarWalletsKit.setWallet(savedId);
        const { address: addr } = await StellarWalletsKit.getAddress();
        if (!addr) return;
        setAddress(addr);
        try {
          const { network: net } = await StellarWalletsKit.getNetwork();
          setNetwork(net);
        } catch {
          setNetwork(null);
        }
      } catch {
        localStorage.removeItem(WALLET_KEY);
      }
    })();
  }, []);

  // Keep local state in sync with kit-level disconnects.
  useEffect(() => {
    return StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setAddress(null);
      setNetwork(null);
      setWalletName(null);
      localStorage.removeItem(WALLET_KEY);
    });
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const { address: addr } = await StellarWalletsKit.authModal({});
      if (!addr) throw new Error("No address returned from the selected wallet.");
      setAddress(addr);

      const selected = StellarWalletsKit.selectedModule;
      if (selected) {
        localStorage.setItem(WALLET_KEY, selected.productId);
        setWalletName(selected.productName);
      }

      try {
        const { network: net } = await StellarWalletsKit.getNetwork();
        setNetwork(net);
      } catch {
        setNetwork(null);
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      // Some modules can't disconnect programmatically — clear our own session anyway.
    }
    setAddress(null);
    setNetwork(null);
    setWalletName(null);
    localStorage.removeItem(WALLET_KEY);
  }, []);

  const sign = useCallback(
    async (xdr: string) => {
      if (!address) throw new Error("Wallet not connected.");
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: config.networkPassphrase,
        address,
      });
      return signedTxXdr;
    },
    [address]
  );

  return {
    connected: address != null,
    address,
    network,
    walletName,
    connecting,
    connect,
    disconnect,
    sign,
  };
}
