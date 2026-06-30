import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Plain content card. The OS window already provides the title bar and
 * close/minimize/maximize controls — this just groups screen content. */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.6)] ${className}`}
    >
      {children}
    </div>
  );
}
