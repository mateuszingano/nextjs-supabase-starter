// Design tokens — a TypeScript mirror of the LIGHT values from src/app/globals.css.
//
// globals.css is the SOURCE OF TRUTH; this file lets code read the same values
// (charts, emails, a theme editor, etc.). Dark mode is handled purely in CSS (the
// `prefers-color-scheme: dark` block in globals.css), so this mirror carries only the
// light base — keep it in sync with the :root values there.

export const tokens = {
  colors: {
    background: '#ffffff',
    surface: '#f9fafb',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    primary: '#4f46e5',
    primaryForeground: '#ffffff',
    primaryHover: '#4338ca',
    danger: '#dc2626',
    success: '#16a34a',
  },
  radius: '0.5rem',
} as const

// The CSS variable name behind each token — for code that reads/writes the live
// value at runtime (e.g. getComputedStyle, or a runtime theme switcher).
export const cssVars = {
  background: '--background',
  surface: '--surface',
  foreground: '--foreground',
  muted: '--muted',
  border: '--border',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  primaryHover: '--primary-hover',
  danger: '--danger',
  success: '--success',
} as const

export type ColorToken = keyof typeof tokens.colors
