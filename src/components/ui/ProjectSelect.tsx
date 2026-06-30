import type { Project } from "../../types";

interface ProjectSelectProps {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
}

export function ProjectSelect({ projects, value, onChange }: ProjectSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mb-3.5 w-full cursor-pointer appearance-none rounded-[6px] border border-border bg-bg bg-[length:12px] bg-[right_10px_center] bg-no-repeat px-3 py-[9px] font-sans text-[13px] text-text outline-none focus:border-accent"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b6b7a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
      }}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji} {p.client ? `${p.client} — ${p.name}` : p.name}
        </option>
      ))}
    </select>
  );
}
