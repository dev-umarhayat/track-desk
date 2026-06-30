import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "start" | "pause" | "stop" | "keep" | "discard" | "fw";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "w-full bg-accent text-[#0a1a10] font-semibold py-[11px] rounded-md hover:opacity-90",
  start:
    "flex items-center gap-1.5 rounded-md border border-accent bg-accent-dim px-7 py-2.5 font-semibold text-accent hover:bg-accent hover:text-[#0a1a10]",
  pause:
    "flex items-center gap-1.5 rounded-md border border-orange bg-orange-dim px-5 py-2.5 font-semibold text-orange hover:bg-orange hover:text-[#1a0800]",
  stop:
    "flex items-center gap-1.5 rounded-md border border-danger bg-surface3 px-5 py-2.5 font-semibold text-danger hover:bg-danger hover:text-[#1a0800]",
  keep:
    "flex-1 rounded-md border border-accent bg-accent-dim py-2.5 font-semibold text-accent hover:bg-accent hover:text-[#0a1a10]",
  discard:
    "flex-1 rounded-md border border-orange bg-orange-dim py-2.5 font-semibold text-orange hover:bg-orange hover:text-[#1a0800]",
  fw: "flex-1 rounded-[5px] border border-border bg-surface3 px-1.5 py-1.5 text-center text-[11px] font-semibold text-text2 hover:border-accent hover:text-accent",
};

export function Button({ variant = "primary", className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`cursor-pointer font-sans text-[13px] transition-colors duration-200 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
