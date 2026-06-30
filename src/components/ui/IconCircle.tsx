import type { ReactNode } from "react";

interface IconCircleProps {
  children: ReactNode;
  tone?: "orange" | "danger";
  size?: number;
}

const TONE_CLASSES: Record<NonNullable<IconCircleProps["tone"]>, string> = {
  orange: "border-orange bg-orange-dim text-orange",
  danger: "border-danger bg-danger-dim text-danger",
};

export function IconCircle({ children, tone = "orange", size = 52 }: IconCircleProps) {
  return (
    <div
      className={`mx-auto mb-3.5 flex items-center justify-center rounded-full border ${TONE_CLASSES[tone]}`}
      style={{ width: size, height: size }}
    >
      {children}
    </div>
  );
}
