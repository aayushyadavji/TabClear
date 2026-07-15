import { useState } from "react";
import { Check } from "./icons";

interface Props {
  balanceLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function CashoutModal({ balanceLabel, onClose, onConfirm }: Props) {
  const [done, setDone] = useState(false);

  return (
    <div className="overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!done ? (
          <>
            <h3>Cash out</h3>
            <p>
              Move your available balance to your linked bank account. This step is a
              preview in the White Belt demo — no real off-ramp yet.
            </p>
            <div className="modal-amount">{balanceLabel}</div>
            <p style={{ marginTop: 8, fontSize: 12.5 }}>XLM available now</p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginBottom: 10 }}
              onClick={() => {
                setDone(true);
                onConfirm();
              }}
            >
              Confirm cash out
            </button>
            <button className="modal-close" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="success-check">
              <Check />
            </div>
            <h3>Cash-out requested</h3>
            <p>Processing to your linked account. (Preview — a real SEP-24 anchor integration lands at a later belt.)</p>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
