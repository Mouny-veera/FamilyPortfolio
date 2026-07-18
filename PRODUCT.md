# Product

## Register

product

## Platform

web

## Users

A family of stock investors on the Indian market (NSE), starting with 5 core members (Veerakumar, Sneeha, Mouny, Mani, Devi) and likely expanding to extended family and friends. They check holdings during and after market hours on phones and laptops, want to see profit/loss at a glance, and need to act on sell opportunities when stocks hit target thresholds. Technical comfort ranges from basic (parents checking totals) to advanced (Mouny managing the tool itself).

## Product Purpose

Replace per-member Excel tracking with a single live dashboard that shows each family member's holdings, lot-level buy/sell history, unrealized P&L with live NSE prices, and automated Fibonacci retracement scanning for buy opportunities. The app runs locally at zero cost and stores everything in SQLite. Success means the family stops opening Excel files and trusts the app as the single source of truth for portfolio decisions.

## Positioning

**One family's complete stock portfolio — live prices, lot tracking, and scanner — running locally for free.** Not a brokerage, not a social platform, not a generic finance SaaS. A private tool built for exactly how this family tracks stocks.

## Brand Personality

**Clean, precise, trusted.** The interface should feel like a well-made instrument panel: every number is reliable, every interaction is predictable, nothing decorative competes with the data. Professional enough to take seriously, simple enough that any family member can use it without training.

## Anti-references

- **Zerodha / Groww / brokerage apps**: This is not a trading platform. No order flow, no chart overload, no gamification or streak mechanics. The app tracks what was already bought and sold — it doesn't execute trades.
- **Spreadsheet-in-a-browser**: The Excel origin should be invisible. Real app affordances (grouped lots, tabbed views, skeleton states), not raw grids.

## Design Principles

1. **Numbers are the product.** Every design decision serves readability of financial data — monospace tabular figures, clear profit/loss color coding, clean alignment.
2. **Trust through consistency.** Same component vocabulary across every screen. Same button shapes, same card patterns, same color semantics. Predictability builds confidence.
3. **Family-scale, not enterprise-scale.** 5 members, ~50 holdings each. No pagination, no complex filters, no role-based access. Design for the actual data volume.
4. **Show the portfolio, not the app.** Minimal chrome. The sidebar, topbar, and navigation should disappear into the task. Data density over decorative spacing.
5. **Dark-first, light-ready.** The primary context is evening review after market close — dark mode is the natural default, light mode is the alternative.

## Accessibility & Inclusion

Standard best practices. Family members have no known accessibility needs. Maintain WCAG AA contrast ratios and keyboard navigability as baseline hygiene.
