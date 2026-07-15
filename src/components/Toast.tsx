import { useState, useCallback, useRef } from "react";

export interface ToastState {
  message: string;
  variant: "default" | "error";
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: "",
    variant: "default",
    visible: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, variant: "default" | "error" = "default") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, variant, visible: true });
    timer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 2800);
  }, []);

  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className={`toast${toast.visible ? " show" : ""}${toast.variant === "error" ? " error" : ""}`}>
      <span className="dot" />
      <span>{toast.message}</span>
    </div>
  );
}
