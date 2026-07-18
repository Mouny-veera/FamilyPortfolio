---
name: Family Portfolio
description: A private family stock portfolio tracker with live NSE prices, lot-level tracking, and Fibonacci scanning.
colors:
  emerald-accent: "#10B981"
  emerald-light: "#34D399"
  emerald-deep: "#059669"
  profit-light: "#10B981"
  profit-dark: "#059669"
  loss-rose: "#F43F5E"
  loss-crimson: "#E11D48"
  indigo-info: "#6366F1"
  amber-warning: "#F59E0B"
  chart-pink: "#EC4899"
  chart-blue: "#3B82F6"
  light-bg-primary: "#FAFAF9"
  light-bg-secondary: "#F1F0EE"
  light-bg-elevated: "#F5F5F4"
  light-bg-card: "#FFFFFF"
  light-text-primary: "#0C0A09"
  light-text-secondary: "#57534E"
  light-text-muted: "#78716C"
  modal-backdrop: "rgba(0, 0, 0, 0.5)"
  dark-bg-primary: "#020617"
  dark-bg-secondary: "#0B1120"
  dark-bg-elevated: "#131B2E"
  dark-bg-sidebar: "#070D1B"
  dark-bg-card: "#0B1120"
  dark-text-primary: "#F1F5F9"
  dark-text-secondary: "#94A3B8"
  dark-text-muted: "#7689A3"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.06em"
  mono:
    fontFamily: "JetBrains Mono, Fira Code, SF Mono, ui-monospace, monospace"
    fontFeature: "tnum"
rounded:
  xs: "3px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.emerald-accent}, {colors.emerald-deep})"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "linear-gradient(135deg, {colors.emerald-accent}, {colors.emerald-deep})"
    textColor: "#FFFFFF"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.loss-rose}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  card-surface:
    backgroundColor: "var(--bg-card)"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  input-default:
    backgroundColor: "transparent"
    textColor: "var(--text-primary)"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  chip-alert:
    backgroundColor: "rgba(16, 185, 129, 0.1)"
    textColor: "{colors.emerald-accent}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  chip-signal:
    backgroundColor: "rgba(245, 158, 11, 0.1)"
    textColor: "{colors.amber-warning}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Family Portfolio

## 1. Overview

**Creative North Star: "The Family Ledger"**

This is a trusted, precise record — a well-kept family book where every number is deliberate and every entry is permanent. The interface serves one purpose: making financial data instantly readable so the family can make confident decisions. It is dark-first because the primary context is evening review after market close, built for a family whose comfort with technology ranges from basic to advanced.

The system rejects the aesthetics of brokerage apps (Zerodha, Groww) — no gamification, no chart overload, no trading-floor energy. It equally rejects the spreadsheet-in-a-browser look — the Excel origin must be invisible, replaced by real app affordances (grouped lots, tabbed views, skeleton loading states). What remains is an instrument panel: emerald for growth, rose for loss, and a deep slate canvas that lets the numbers breathe.

**Key Characteristics:**
- **Data-dense, not decorative.** Every pixel serves readability. Monospace tabular figures, clean alignment, Indian locale formatting.
- **Dark-first, light-ready.** The three-tier dark background (#020617 → #0B1120 → #131B2E) is the natural home; light mode is the alternative.
- **Family-scale simplicity.** 5 members, ~50 holdings each. No pagination, no complex filters, no role-based access.
- **Trust through consistency.** Same card shapes, same color semantics, same typography across every screen.
- **Emerald as the single accent.** Used sparingly on CTAs and profit states. Its rarity on surfaces is the point.

## 2. Colors

The palette is restrained: one accent carried through a tinted-neutral dark canvas. Color is functional, never decorative — emerald means profit or action, rose means loss or danger, and everything else stays neutral.

### Primary
- **Emerald Accent** (#10B981): Primary CTA buttons, profit indicators in dark mode, accent glows, alert badges. The single brand color. Used in gradient form (135deg, #10B981 → #059669) on primary buttons and the app logo.
- **Emerald Deep** (#059669): Profit indicators in light mode, button gradient terminus, hover states on accent elements.
- **Emerald Light** (#34D399): Lighter accent variant for subtle highlights and hover states.

### Tertiary
- **Indigo Info** (#6366F1): Current value metric cards, informational badges. A cool complement to emerald that carries no financial meaning.
- **Amber Warning** (#F59E0B): Scanner signal badges ("Near 0.618"), warning states, the active alerts metric. Warm and attention-seeking.
- **Chart Pink** (#EC4899): Fourth position in the 5-color chart palette. Used only in pie/allocation charts.
- **Chart Blue** (#3B82F6): Fifth position in the chart palette. Used only in pie/allocation charts.

### Neutral
- **Dark Canvas** (#020617): Primary background in dark mode. Near-black with a cool blue undertone.
- **Dark Surface** (#0B1120): Card and secondary background in dark mode. One step lifted from canvas.
- **Dark Elevated** (#131B2E): Elevated surfaces (skeleton loaders, table headers, tooltips) in dark mode.
- **Dark Sidebar** (#070D1B): Sidebar background in dark mode. Slightly deeper than canvas for visual separation.
- **Light Stone** (#FAFAF9): Primary background in light mode. Warm stone-white.
- **Light Linen** (#F1F0EE): Secondary background in light mode.
- **Light Elevated** (#F5F5F4): Elevated surfaces in light mode.
- **Light Card** (#FFFFFF): Card surfaces in light mode.
- **Dark Ink** (#0C0A09): Primary text in light mode.
- **Slate Secondary** (#57534E): Secondary text in light mode.
- **Stone Muted** (#78716C): Muted text and labels in light mode. WCAG AA compliant (4.59:1 on #FAFAF9).
- **Slate Light** (#F1F5F9): Primary text in dark mode.
- **Blue-gray Secondary** (#94A3B8): Secondary text in dark mode.
- **Steel Muted** (#7689A3): Muted text and labels in dark mode. WCAG AA compliant (5.65:1 on #020617).

### Semantic Color Rules
- **Profit** uses --color-profit: #10B981 (dark) / #059669 (light).
- **Loss** uses --color-loss: #F43F5E (dark) / #E11D48 (light).
- Both pairs maintain WCAG AA contrast against their respective backgrounds.

### Named Rules
**The Emerald Budget Rule.** The primary accent appears on buttons, profit states, and alert badges — never as a background fill, border stripe, or decorative element. Its presence signals "action" or "gain." Overuse dilutes the signal.

**The Semantic Pair Rule.** Profit and loss colors switch between dark and light mode. Never hardcode #10B981 for profit — use var(--color-profit) so the correct value loads per theme.

## 3. Typography

**Display Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI fallbacks)
**Mono Font:** JetBrains Mono (with Fira Code, SF Mono fallbacks)

**Character:** Inter carries the interface with OpenType features cv02, cv03, cv04, cv11 — disambiguated letterforms that serve data-heavy screens. JetBrains Mono handles every number in the app, enforcing tabular alignment and making financial figures instantly scannable. The pairing is functional: one face for reading, one for counting.

### Hierarchy
- **Display** (600, 22px, 1.2, -0.02em tracking): Page titles — "Dashboard", member names. The largest text in the system. One per page, no exceptions.
- **Heading** (600, 15px, 1.3, -0.01em tracking): Modal titles, dialog headings. Between display and body.
- **Title** (600, 14px, 1.3): Section headings within pages — "Family Members", "Top Picks", member group names. Slightly larger than body.
- **Body** (400, 13px, 1.5): Table cells, descriptions, form labels. The workhorse size.
- **Caption** (400, 12px, 1.5): Helper text, secondary descriptions, data source labels, form error messages.
- **Small** (500, 11px, 1.3): Button labels in compact contexts, badge text, inline action labels, status indicators.
- **Label** (600, 10px, 1.2, 0.06–0.08em tracking, uppercase): Column headers, metric card labels, status badges. Always uppercase, always tracked out. The smallest text in the system.
- **Mono** (JetBrains Mono, tabular-nums): Every financial figure — prices, quantities, percentages, dates in tables. font-variant-numeric: tabular-nums ensures column alignment.

### Named Rules
**The Mono-for-Money Rule.** Every number that represents a financial value, quantity, or percentage must use JetBrains Mono with tabular-nums. No exceptions. A number in Inter is a bug.

**The Label Ceiling Rule.** Labels are 10–11px uppercase with wide tracking. Nothing in the system is smaller than 10px. If text needs to be that small, it's a label or it shouldn't exist.

## 4. Elevation

This system uses tonal layering, not shadows, as the primary depth mechanism. Surfaces communicate hierarchy through background color steps: canvas → surface → elevated. Shadows exist but play an ambient, reinforcing role — they're barely visible in dark mode and subtle in light mode.

### Shadow Vocabulary
- **Card** (`0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` light / `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)` dark): Default surface. Applied to every card, table container, and metric card. Barely perceptible — the tonal step does the work.
- **Elevated** (`0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)` light / `0 4px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)` dark): Tooltips, dropdowns, modals, and elevated surfaces. Noticeably lifted but never harsh.
- **Accent Glow** (`0 2px 8px rgba(16, 185, 129, 0.25)`): Primary CTA buttons only. A colored shadow that reinforces the emerald accent.

### Named Rules
**The Flat-by-Default Rule.** Surfaces are flat at rest. The three-tier tonal system (canvas → surface → elevated) handles all depth. Shadows reinforce, they don't create. If removing the shadow makes the hierarchy ambiguous, the background colors are wrong.

## 5. Components

Components are precise and confident — tight radii, clean borders, decisive color. Every interactive element reads as engineered, not decorated.

### Buttons
- **Shape:** Gently curved (12px radius), compact padding (8px 14px).
- **Primary:** Emerald gradient (135deg, #10B981 → #059669) with white text and accent glow shadow. The only gradient in the system.
- **Hover / Focus:** `brightness(1.1)` filter on hover. Focus ring: 2px solid emerald, 2px offset.
- **Destructive:** Transparent background, rose text (#F43F5E), rose border at 0.3 opacity. Used for sell actions. Never a filled red button.
- **Ghost:** Transparent with muted text, subtle hover background (black/5% light, white/5% dark).

### Chips / Badges
- **Alert Badge:** Emerald-tinted background (rgba(16, 185, 129, 0.1)), emerald text, rounded-md (8px). Used for alert counts and profit-alert percentage badges. Pulses subtly on active alerts.
- **Signal Badge:** Amber-tinted background (rgba(245, 158, 11, 0.1)), amber text, rounded-md. Used for scanner signal indicators ("Near 0.618").

### Cards / Containers
- **Corner Style:** Rounded-xl (12px radius) on all cards and table containers.
- **Background:** var(--bg-card) — white in light mode, dark surface in dark mode.
- **Shadow Strategy:** var(--shadow-card) reinforces tonal layering (see Elevation).
- **Border:** 1px solid var(--border-color) — rgba-based, never a solid color. Borders are structural, not decorative.
- **Internal Padding:** 16–20px horizontal, 12–16px vertical. Metric cards use px-5 py-4.
- **Metric Cards:** Subtle gradient background tint (8% accent opacity fading to 0%), accent-colored border (15% opacity). Each card has a leading icon at 70% opacity.

### Inputs / Fields
- **Style:** Transparent background, 1px border (var(--border-color)), 12px radius. No fill — the field lives on whatever surface it's placed on.
- **Focus:** Border shifts to emerald accent, 2px ring at rgba(16, 185, 129, 0.15) opacity. Applied globally via CSS.
- **Search variant:** Left-aligned search icon (14px, muted color), right-aligned clear button with generous touch target (p-2).

### Navigation
- **Sidebar:** Fixed left panel, hidden below 1024px. Dark sidebar background (var(--bg-sidebar)) creates a fourth depth level. Navigation items are 13px medium weight with 16px icons, 6px radius on hover/active.
- **Active state:** Emerald text + emerald-tinted background (8% opacity). No border indicators.
- **Mobile:** Slide-in overlay from left (slideInFromLeft animation, 200ms) with backdrop blur. Hamburger toggle in TopBar.
- **Tab bar:** Segmented control style — rounded-lg container with var(--bg-secondary) fill, active tab gets var(--bg-card) background with card shadow. 13px medium text.

### Tables
- **Header:** Uppercase label style (10px, semibold, wide tracking, muted color), elevated background. Sticky headers where needed.
- **Rows:** 13px body text, generous padding (px-5 py-3.5). Hover: subtle background shift (black/2% light, white/2% dark). Borders between rows use var(--border-subtle) at 4% opacity.
- **Financial columns:** Always font-mono tabular-nums. Right-aligned for numbers, left-aligned for text.
- **Alert rows:** Emerald-tinted background (var(--alert-row-bg)) for rows where profit exceeds 10% threshold.

### Charts (Recharts)
- **Palette:** 5-color rotation: Emerald (#10B981), Indigo (#6366F1), Amber (#F59E0B), Pink (#EC4899), Blue (#3B82F6). Mapped by member index in allocation charts.
- **Tooltips:** Custom styled to match card component — elevated background, border, elevated shadow, rounded-xl.
- **Animation:** 800ms ease-out entrance, disabled when prefers-reduced-motion is active.
- **Bar charts:** Profit bars use --color-profit, loss bars use --color-loss. No gradient fills on bars.

### Loading States
- **Skeleton screens** (not spinners) for page-level loading. Skeleton blocks use var(--bg-elevated) background with the page's actual layout structure — metric cards, table rows, heading blocks.
- **Inline spinners:** Small border-based spinner (border-2 with accent color) for button loading states and scanning operations.
- **Page entrance:** fadeIn + translateY(6px) over 350ms with cubic-bezier(0.16, 1, 0.3, 1) easing.
- **Stagger:** List items stagger by 30–50ms per item using animation-delay utility classes.

## 6. Do's and Don'ts

### Do:
- **Do** use var(--color-profit) and var(--color-loss) for all financial indicators. Never hardcode #10B981 or #F43F5E in components.
- **Do** use font-mono tabular-nums for every financial number, quantity, percentage, and date in tables.
- **Do** use skeleton loading states that mirror the actual page layout. 3 metric card skeletons + 3–5 row skeletons is the standard pattern.
- **Do** use rgba-based borders (var(--border-color), var(--border-subtle)). They adapt to both themes without separate values.
- **Do** format all currency in INR with Indian locale (en-IN). Use the ₹ symbol, not "INR" or "Rs."
- **Do** use the three-tier background system for depth: canvas (--bg-primary) → surface (--bg-card) → elevated (--bg-elevated).
- **Do** respect prefers-reduced-motion by disabling all animations. The @media query in index.css handles this globally.
- **Do** provide visible focus rings (2px solid emerald, 2px offset) on all interactive elements.

### Don't:
- **Don't** make this look like Zerodha or Groww. No candlestick charts, no order flow UI, no gamification mechanics, no streak counters, no achievement badges. This tracks holdings — it doesn't execute trades.
- **Don't** make this look like a spreadsheet in a browser. No raw data grids, no cell borders, no formula bars. Use grouped lots, tabbed views, and card-based metric displays instead.
- **Don't** use side-stripe borders (border-left/right > 1px as colored accents). Prohibited.
- **Don't** use gradient text (background-clip: text). Prohibited.
- **Don't** use the emerald gradient anywhere except primary CTA buttons and the app logo. It is not a decorative element.
- **Don't** use Tailwind bracket syntax for colors (e.g., `border-[#10B981]`). Always use CSS custom properties via var() or @theme tokens.
- **Don't** add pagination, complex filters, or role-based access controls. The data volume is 5 members × ~50 holdings. Design for that scale.
- **Don't** use spinners for page-level loading. Skeleton screens are the standard. Spinners are only for inline button states and scanning operations.
- **Don't** use solid border colors. All borders use rgba() values that adapt naturally across themes.
- **Don't** pair two sans-serif fonts. Inter handles all UI text; JetBrains Mono handles all numbers. There is no third font.
