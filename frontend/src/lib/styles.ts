/** Inline style objects for the design-system tokens.
 *
 *  These wrap CSS variables from index.css so components can pass them to
 *  `style={}` without re-declaring the same literal in every file. Frozen at
 *  module scope, so they're referentially stable and never trigger a re-render
 *  the way an inline object literal would.
 *
 *  Colours belong in index.css — add a variable there and surface it here,
 *  rather than writing a raw hex value in a component.
 */

export const textPrimary = { color: "var(--text-primary)" } as const
export const textSecondary = { color: "var(--text-secondary)" } as const
export const textMuted = { color: "var(--text-muted)" } as const

export const bgCard = { backgroundColor: "var(--bg-card)" } as const
export const bgElevated = { backgroundColor: "var(--bg-elevated)" } as const
export const bgSecondary = { backgroundColor: "var(--bg-secondary)" } as const

export const colorProfit = { color: "var(--color-profit)" } as const
export const colorLoss = { color: "var(--color-loss)" } as const
export const colorAccent = { color: "var(--color-accent)" } as const

export const dashedBorder = { border: "1px dashed var(--border-color)" } as const
export const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  boxShadow: "var(--shadow-card)",
} as const

/** Gradient buttons: the primary action on a surface. */
export const accentButton = {
  background: "var(--gradient-accent)",
  boxShadow: "var(--shadow-accent)",
} as const
