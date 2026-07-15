import type { ReactNode } from "react";

const s = { fill: "none" } as const;

export const Arrow = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Menu = () => (
  <svg viewBox="0 0 24 24" {...s} width="11" height="11">
    <path d="M4 12h16M4 6h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Chevron = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" {...s}>
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Copy = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const Logout = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Refresh = () => (
  <svg viewBox="0 0 24 24" {...s} width="15" height="15">
    <path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SendIcon = () => (
  <svg viewBox="0 0 24 24" {...s} width="15" height="15">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CashOut = () => (
  <svg viewBox="0 0 24 24" {...s} width="15" height="15">
    <path d="M12 4v16M6 10l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check = () => (
  <svg viewBox="0 0 24 24" {...s} width="26" height="26">
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Bolt = () => (
  <svg viewBox="0 0 24 24" {...s} width="20" height="20">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

export const CardOff = () => (
  <svg viewBox="0 0 24 24" {...s} width="20" height="20">
    <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 9h18" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const QrIcon = () => (
  <svg viewBox="0 0 24 24" {...s} width="20" height="20">
    <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
    <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
    <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export const Clock = () => (
  <svg viewBox="0 0 24 24" {...s} width="20" height="20">
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const Inbox = () => (
  <svg viewBox="0 0 24 24" {...s} width="22" height="22">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCircle = ({ children }: { children: ReactNode }) => (
  <span className="icon-circle">{children}</span>
);
