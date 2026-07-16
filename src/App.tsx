import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { useToast, Toast } from "./components/Toast";
import { Landing } from "./components/Landing";
import { Dashboard } from "./components/Dashboard";
import { readableError } from "./lib/stellar";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const wallet = useWallet();
  const { toast, show } = useToast();
  const [entered, setEntered] = useState(false);

  async function handleGetStarted() {
    if (wallet.connected) {
      setEntered(true);
      return;
    }
    try {
      await wallet.connect();
      setEntered(true);
      show("Wallet connected");
    } catch (err) {
      show(readableError(err), "error");
    }
  }

  function handleDisconnect() {
    wallet.disconnect();
    setEntered(false);
    show("Wallet disconnected");
  }

  const showDashboard = entered && wallet.connected;

  return (
    <>
      {showDashboard ? (
        <Dashboard wallet={wallet} onBackToLanding={handleDisconnect} toast={show} />
      ) : (
        <Landing onGetStarted={handleGetStarted} />
      )}
      <Toast toast={toast} />
      <Analytics />
    </>
  );
}
