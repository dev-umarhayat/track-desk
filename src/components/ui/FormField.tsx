import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FormField({ label, className = "", ...rest }: FormFieldProps) {
  return (
    <div className="mb-3.5">
      <div className="mb-[5px] text-[11px] font-medium uppercase tracking-wide text-muted">{label}</div>
      <input
        className={`w-full rounded-[6px] border border-border bg-bg px-3 py-2.5 font-sans text-[13px] text-text outline-none transition-colors focus:border-accent ${className}`}
        {...rest}
      />
    </div>
  );
}
