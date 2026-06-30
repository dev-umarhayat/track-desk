interface StatCellData {
  label: string;
  value: string;
  color?: "default" | "orange" | "blue";
}

const COLOR_CLASSES: Record<NonNullable<StatCellData["color"]>, string> = {
  default: "text-text",
  orange: "text-orange",
  blue: "text-blue",
};

export function StatsGrid({ stats }: { stats: StatCellData[] }) {
  return (
    <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface px-3.5 py-[11px]">
          <div className={`font-mono text-[16px] font-medium ${COLOR_CLASSES[s.color ?? "default"]}`}>
            {s.value}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
