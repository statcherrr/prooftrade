import { type CSSProperties } from "react";

// -----------------------------------------------  Liquid-glass design tokens (Phase 3.8)
// -----------------------------------------------  Deep black/graphite backgrounds, icy-blue/cyan accents, layered translucent glass panels, controlled specular highlights.

export const designTokens = {
  // ---- backgrounds ----
  bgPrimary: "#07090d",
  bgSecondary: "#0c0f14",
  bgTertiary: "#11151e",
  bgSurface: "#141923",
  bgOverlay: "rgba(7, 9, 13, 0.82)",

  // ---- borders ----
  borderBase: "#222836",
  borderGlow: "rgba(59, 130, 246, 0.55)",
  borderSubtle: "rgba(255, 255, 255, 0.06)",

  // ---- text ----
  textPrimary: "#eef4fb",
  textSecondary: "#97a4b7",
  textMuted: "#65728a",
  textDestructive: "#ff5c6c",

  // ---- accents ----
  accentBlue: "#3b82f6",
  accentCyan: "#0ea5e9",
  accentPurple: "#8b5cf6",
  accentRed: "#ef4444",
  accentGreen: "#22c55e",

  // ---- glass ----
  glassBase: "rgba(255, 255, 255, 0.05)",
  glassElevated: "rgba(255, 255, 255, 0.10)",
  glassSubtle: "rgba(255, 255, 255, 0.16)",
  glassFrosted: "rgba(255, 255, 255, 0.32)",

  // ---- blurs ----
  blurXs: "4px",
  blurSm: "8px",
  blurMd: "16px",
  blurLg: "28px",
  blurXl: "56px",

  // ---- light ----
  lightDir: "120deg",
  lightStrength: "90%",
  lightDesat: "18%",

  // ---- radius ----
  radiusSm: "8px",
  radiusMd: "12px",
  radiusLg: "20px",
  radiusXl: "32px",

  // ---- spacing ----
  spaceXs: "4px",
  spaceSm: "8px",
  spaceMd: "16px",
  spaceLg: "24px",
  spaceXl: "32px",

  // ---- motion ----
  durFast: "120ms",
  durBase: "200ms",
  durSlow: "360ms",
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  stanSlow: "0.6s",

  // ---- motion offsets ----
  offsetXs: "4px",
  offsetSm: "8px",
  offsetMd: "12px",
  offsetLg: "20px",
} as const;

export type ColorToken = typeof designTokens.bgPrimary;

export type GlassVariant = "base" | "elevated" | "subtle" | "frosted";

export interface GlassOptions {
  variant?: GlassVariant;
  blur?: number;
  offset?: [number, number];
  glow?: boolean;
  highlight?: boolean;
}

export function glassStyles(opts: GlassOptions = {}): CSSProperties {
  const { variant = "elevated", blur = 12, offset = [6, 10], glow = false, highlight = true } = opts;

  const v: Record<GlassVariant, string> = {
    base: designTokens.glassBase,
    elevated: designTokens.glassElevated,
    subtle: designTokens.glassSubtle,
    frosted: designTokens.glassFrosted,
  };

  const b = Array.isArray(offset) ? `${offset[0]}px ${offset[1]}px` : offset;

  const gl: CSSProperties = {
    backgroundColor: v[variant],
    backdropFilter: `blur(${blur}px)`,
    border: `1px solid ${designTokens.borderSubtle}`,
    borderColor: variant === "frosted" ? designTokens.borderGlow : designTokens.borderSubtle,
    boxShadow: glow
      ? `0 10px 40px -12px rgba(14, 26, 42, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)`
      : `0 8px 28px -14px rgba(14, 26, 42, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)`,
    outline: "none",
    transition: `box-shadow var(${designTokens.durBase}) ${designTokens.easing}, border-color var(${designTokens.durBase}) ${designTokens.easing}`,
  };

  if (highlight) {
    gl.boxShadow = gl.boxShadow
      ? `${gl.boxShadow}, inset 0 1px 0 0 rgba(255, 255, 255, 0.18)`
      : "inset 0 1px 0 0 rgba(255, 255, 255, 0.10)";
  }

  return gl;
}

export const glassUnderlay = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  background: "radial-gradient(120% 80% at 50% 0%, rgba(14, 26, 42, 0.45) 0%, rgba(7, 9, 13, 0.85) 60%, transparent 100%)",
  mixBlendMode: "multiply",
  zIndex: 0,
} as const;

export const glassAccentGlow = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  borderRadius: "inherit",
  background: "radial-gradient(120% 120% at 50% 50%, rgba(59, 130, 246, 0.18), transparent 70%)",
  zIndex: 0,
} as const;

export const glassGlowKeyframes = {
  "glass-glow": {
    "0%": { opacity: "0", transform: "scale(0.92)" },
    "100%": { opacity: "0.55", transform: "scale(1.08)" },
  },
  "glass-glow2": {
    "0%": { opacity: "0", transform: "scale(0.9)" },
    "100%": { opacity: "0.4", transform: "scale(1.12)" },
  },
  "glass-glow-translate": {
    "0%": { transform: "translateX(0)" },
    "100%": { transform: "translateX(34px)" },
  },
  "glass-shimmer": {
    "0%": { backgroundPosition: "-200% center" },
    "100%": { backgroundPosition: "200% center" },
  },
} as const;

export const glassAnim = {
  glow: "@keyframes glass-glow",
  glow2: "@keyframes glass-glow2",
  glowTranslate: "@keyframes glass-glow-translate",
  shimmer: "@keyframes glass-shimmer",
} as const;

export const glassRef = {
  base: "glass-ref",
  elevated: "glass-elevated-ref",
  subtle: "glass-subtle-ref",
  frosted: "glass-frosted-ref",
} as const;

export const glassClassNames = {
  base: "glass-ref",
  elevated: "glass-elevated-ref",
  subtle: "glass-subtle-ref",
  frosted: "glass-frosted-ref",
} as const;

export function glassClass(): string {
  return "glass-ref";
}

export const liquidMetalButton = {
  base: "liquid-metal-btn",
  hover: "liquid-metal-btn-hover",
  active: "liquid-metal-btn-active",
  focus: "liquid-metal-btn-focus",
  disabled: "liquid-metal-btn-disabled",
} as const;

export const liquidMetalClassNames = {
  base: "liquid-metal-btn",
  hover: "liquid-metal-btn-hover",
  active: "liquid-metal-btn-active",
  focus: "liquid-metal-btn-focus",
  disabled: "liquid-metal-btn-disabled",
} as const;
