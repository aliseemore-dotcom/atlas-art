import type { CSSProperties } from "react";

export type MedallionRole = "master" | "teacher" | "follower" | "rail";

const SPEC: Record<MedallionRole, { w: number; h: number; font: number; bg: string; fg: string; border: string }> = {
  master: { w: 132, h: 168, font: 44, bg: "var(--color-wine)", fg: "var(--color-on-wine)", border: "2px solid var(--color-wine)" },
  teacher: { w: 96, h: 124, font: 28, bg: "var(--color-milk)", fg: "var(--color-ink)", border: "2px solid var(--color-wine)" },
  follower: { w: 96, h: 124, font: 28, bg: "var(--color-heavenly)", fg: "var(--color-ink)", border: "1px solid var(--color-wine)" },
  rail: { w: 44, h: 56, font: 16, bg: "var(--color-cream)", fg: "var(--color-ink)", border: "1px solid var(--color-crust)" },
};

/** Овальный медальон (radius-oval, не круг). Без портрета — инициалы; портрет — только с подтверждёнными правами. */
export function Medallion({
  role,
  initials,
  portraitUrl,
  alt = "",
  active = false,
}: {
  role: MedallionRole;
  initials: string;
  portraitUrl?: string | null;
  alt?: string;
  active?: boolean;
}) {
  const s = SPEC[role];
  const style: CSSProperties = {
    width: s.w,
    height: s.h,
    borderRadius: "50%",
    background: s.bg,
    color: s.fg,
    border: active ? "2px solid var(--color-wine)" : s.border,
    boxShadow: active ? "0 0 0 2px var(--color-milk), 0 0 0 4px var(--color-wine)" : undefined,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontSize: s.font,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    flexShrink: 0,
  };
  return (
    <span style={style} data-role={role} aria-hidden={alt ? undefined : true}>
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portraitUrl} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials
      )}
    </span>
  );
}
