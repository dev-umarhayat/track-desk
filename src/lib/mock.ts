import type { Project } from "../types";

export const PROJECTS: Project[] = [
  { id: "p1", name: "Website Redesign", client: "Acme Corp", emoji: "🟢" },
  { id: "p2", name: "Admin Portal", client: "Internal", emoji: "🔵" },
  { id: "p3", name: "No Project", client: "", emoji: "⚪" },
];

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatHM(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function timeAgo(date: Date): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  return `${min} min ago`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
