interface AvatarProps {
  initials: string;
  size?: number;
}

export function Avatar({ initials, size = 30 }: AvatarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-blue bg-blue-dim text-[11px] font-semibold text-blue"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}
