import { useCallback, useMemo, useRef, useState } from "react"
import {
  X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle,
  CalendarClock, Info, ArrowRight,
} from "lucide-react"
import {
  api,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportCommitRow,
  type NseSearchResult,
} from "@/lib/api"
import { formatCurrency, formatNumber } from "@/lib/utils"

interface ImportDialogProps {
  memberId: number
  memberName: string
  onClose: () => void
  onSuccess: () => void
}

const overlay = {
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(4px)",
} as const
const panel = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-color)",
  boxShadow: "var(--shadow-elevated)",
} as const
const textPrimary = { color: "var(--text-primary)" } as const
const textMuted = { color: "var(--text-muted)" } as const
const textSecondary = { color: "var(--text-secondary)" } as const
const subtleCard = {
  backgroundColor: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
} as const
const primaryButton = {
  background: "var(--gradient-accent)",
  boxShadow: "var(--shadow-accent)",
} as const

function needsResolving(row: ImportPreviewRow) {
  return row.match_status !== "exact" && row.match_status !== "alias"
}

function candidateSymbol(c: { symbol?: string; ticker?: string }) {
  return c.symbol || c.ticker || ""
}

export function ImportDialog({ memberId, memberName, onClose, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ lots: number; realized: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // description -> chosen NSE symbol, for names the parser couldn't resolve
  const [resolved, setResolved] = useState<Record<string, string>>({})
  const [searchFor, setSearchFor] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<NseSearchResult[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const selectedSheets = useMemo(
    () => preview?.sheets.filter((s) => s.selected) ?? [],
    [preview],
  )

  // One entry per distinct description, so a name repeated across 20 lots is
  // resolved once rather than twenty times.
  const unresolved = useMemo(() => {
    const map = new Map<string, ImportPreviewRow>()
    for (const sheet of selectedSheets) {
      for (const row of sheet.rows) {
        if (needsResolving(row) && !map.has(row.raw_description)) {
          map.set(row.raw_description, row)
        }
      }
    }
    return [...map.values()]
  }, [selectedSheets])

  const stats = useMemo(() => {
    let holdings = 0, realized = 0, repairs = 0, actions = 0, skipped = 0, notes = 0
    for (const sheet of selectedSheets) {
      if (sheet.kind === "holdings") holdings += sheet.rows.length
      else realized += sheet.rows.length
      skipped += sheet.skipped.length
      notes += sheet.annotations.length
      for (const row of sheet.rows) {
        repairs += row.repairs.length
        if (row.corporate_action) actions += 1
      }
    }
    return { holdings, realized, repairs, actions, skipped, notes }
  }, [selectedSheets])

  const outstanding = unresolved.filter((r) => !resolved[r.raw_description]).length

  const pickFile = useCallback(async (chosen: File) => {
    setError(null)
    setPreview(null)
    setResolved({})
    setFile(chosen)
    setBusy(true)
    try {
      setPreview(await api.previewImport(memberId, chosen))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file")
      setFile(null)
    } finally {
      setBusy(false)
    }
  }, [memberId])

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return }
    try {
      setSearchResults(await api.searchNse(q.trim()))
    } catch {
      setSearchResults([])
    }
  }, [])

  const commit = useCallback(async () => {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const holdings: ImportCommitRow[] = []
      const realized: ImportCommitRow[] = []
      for (const sheet of preview.sheets) {
        if (!sheet.selected) continue
        for (const row of sheet.rows) {
          const ticker = row.ticker || resolved[row.raw_description]
          if (!ticker || !row.buy_date || row.qty == null || row.buy_rate == null) continue
          const base: ImportCommitRow = {
            ticker,
            buy_date: row.buy_date,
            qty: row.qty,
            buy_rate: row.buy_rate,
            buy_value: row.buy_value ?? row.qty * row.buy_rate,
          }
          if (sheet.kind === "realized") {
            if (!row.sell_date) continue
            realized.push({
              ...base,
              sell_date: row.sell_date,
              sell_qty: row.sell_qty,
              sell_rate: row.sell_rate,
              sell_value: row.sell_value,
            })
          } else {
            holdings.push(base)
          }
        }
      }
      const res = await api.commitImport(memberId, holdings, realized)
      setDone({ lots: res.lots_imported, realized: res.realized_imported })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed")
    } finally {
      setBusy(false)
    }
  }, [preview, resolved, memberId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Import from Excel"
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-xl animate-slide-in overflow-hidden"
        style={panel}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight" style={textPrimary}>
              Import from Excel
            </h2>
            <p className="text-[12px] mt-0.5" style={textMuted}>
              {memberName}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg cursor-pointer hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors"
          >
            <X size={16} strokeWidth={2} style={textMuted} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <div className="text-center py-12">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--accent-10)", border: "1px solid var(--accent-15)" }}
              >
                <CheckCircle2 size={22} strokeWidth={1.5} style={{ color: "var(--color-profit)" }} />
              </div>
              <p className="text-[15px] font-semibold mb-1" style={textPrimary}>Import complete</p>
              <p className="text-[13px]" style={textMuted}>
                {done.lots} holding{done.lots !== 1 ? "s" : ""} and {done.realized} realized
                trade{done.realized !== 1 ? "s" : ""} added to {memberName}.
              </p>
            </div>
          ) : !preview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped) pickFile(dropped)
              }}
              className="rounded-xl text-center py-14 transition-colors"
              style={{
                border: `1px dashed ${dragging ? "var(--color-accent)" : "var(--border-color)"}`,
                backgroundColor: dragging ? "var(--accent-10)" : "transparent",
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={22} className="animate-spin mx-auto mb-3" style={{ color: "var(--color-accent)" }} />
                  <p className="text-[13px]" style={textMuted}>Reading {file?.name}…</p>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={26} strokeWidth={1.5} className="mx-auto mb-3" style={textMuted} />
                  <p className="text-[13px] font-medium mb-1" style={textPrimary}>
                    Drop your workbook here
                  </p>
                  <p className="text-[12px] mb-5" style={textMuted}>
                    .xlsx or .xlsm, up to 10 MB. Nothing is saved until you confirm.
                  </p>
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
                    style={primaryButton}
                  >
                    <Upload size={15} strokeWidth={2} />
                    Choose file
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".xlsx,.xlsm"
                    className="hidden"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0]
                      if (chosen) pickFile(chosen)
                    }}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Holdings", value: stats.holdings },
                  { label: "Realized", value: stats.realized },
                  { label: "Dates fixed", value: stats.repairs },
                  { label: "Rows skipped", value: stats.skipped },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg px-3 py-2.5" style={subtleCard}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={textMuted}>
                      {s.label}
                    </p>
                    <p className="text-lg font-mono font-semibold tabular-nums" style={textPrimary}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={textMuted}>
                  Sheets
                </h3>
                <div className="space-y-1.5">
                  {preview.sheets.map((sheet) => (
                    <div key={sheet.name} className="rounded-lg px-3 py-2.5" style={subtleCard}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{
                            backgroundColor: sheet.selected ? "var(--accent-10)" : "transparent",
                            color: sheet.selected ? "var(--color-accent)" : "var(--text-muted)",
                            border: sheet.selected ? "none" : "1px solid var(--border-subtle)",
                          }}
                        >
                          {sheet.selected ? "IMPORTING" : "SKIPPED"}
                        </span>
                        <span className="text-[13px] font-medium" style={textPrimary}>{sheet.name}</span>
                        <span className="text-[12px]" style={textMuted}>
                          {sheet.kind === "holdings" ? "holdings" : "realized"} · {sheet.rows.length} rows
                        </span>
                      </div>
                      {sheet.skip_reason && (
                        <p className="text-[12px] mt-1.5" style={textMuted}>{sheet.skip_reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {unresolved.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "var(--color-warning)" }}>
                    <AlertTriangle size={12} strokeWidth={2.5} />
                    Confirm {unresolved.length} ticker{unresolved.length !== 1 ? "s" : ""}
                  </h3>
                  <p className="text-[12px] mb-2.5" style={textMuted}>
                    These names didn't match an NSE symbol exactly. Pick the right one — rows
                    left unconfirmed are not imported.
                  </p>
                  <div className="space-y-1.5">
                    {unresolved.map((row) => {
                      const chosen = resolved[row.raw_description]
                      return (
                        <div key={row.raw_description} className="rounded-lg px-3 py-2.5" style={subtleCard}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium" style={textPrimary}>
                              {row.raw_description}
                            </span>
                            <ArrowRight size={12} strokeWidth={2} style={textMuted} />
                            {chosen ? (
                              <span
                                className="text-[12px] px-1.5 py-0.5 rounded-md font-semibold font-mono"
                                style={{ backgroundColor: "var(--accent-10)", color: "var(--color-accent)" }}
                              >
                                {chosen}
                              </span>
                            ) : (
                              <span className="text-[12px]" style={textMuted}>not set</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {row.candidates.slice(0, 4).map((c) => {
                              const sym = candidateSymbol(c)
                              if (!sym) return null
                              return (
                                <button
                                  key={sym}
                                  onClick={() => setResolved((p) => ({ ...p, [row.raw_description]: sym }))}
                                  className="text-[12px] px-2 py-1 rounded-md font-mono cursor-pointer transition-colors"
                                  style={{
                                    border: "1px solid var(--border-subtle)",
                                    backgroundColor: chosen === sym ? "var(--accent-10)" : "transparent",
                                    color: chosen === sym ? "var(--color-accent)" : "var(--text-secondary)",
                                  }}
                                >
                                  {sym}
                                </button>
                              )
                            })}
                            <button
                              onClick={() => {
                                setSearchFor(searchFor === row.raw_description ? null : row.raw_description)
                                setSearchResults([])
                              }}
                              className="text-[12px] px-2 py-1 rounded-md cursor-pointer transition-colors"
                              style={{ border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}
                            >
                              Search…
                            </button>
                          </div>
                          {searchFor === row.raw_description && (
                            <div className="mt-2">
                              <input
                                autoFocus
                                type="text"
                                placeholder="Search NSE symbols…"
                                onChange={(e) => runSearch(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-md text-[12px] bg-transparent outline-none"
                                style={{ border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                              />
                              {searchResults.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {searchResults.slice(0, 8).map((r) => (
                                    <button
                                      key={r.symbol}
                                      onClick={() => {
                                        setResolved((p) => ({ ...p, [row.raw_description]: r.symbol }))
                                        setSearchFor(null)
                                        setSearchResults([])
                                      }}
                                      className="text-[12px] px-2 py-1 rounded-md font-mono cursor-pointer"
                                      style={{ border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
                                    >
                                      {r.symbol}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {stats.repairs > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={textMuted}>
                    <CalendarClock size={12} strokeWidth={2.5} />
                    {stats.repairs} date{stats.repairs !== 1 ? "s" : ""} repaired
                  </h3>
                  <div className="rounded-lg px-3 py-2.5 space-y-1" style={subtleCard}>
                    {selectedSheets.flatMap((sheet) =>
                      sheet.rows.flatMap((row) =>
                        row.repairs.map((rep) => (
                          <p key={`${sheet.name}-${row.row_number}-${rep.field}`} className="text-[12px] font-mono" style={textSecondary}>
                            {sheet.name} row {row.row_number}: {rep.original} → {rep.repaired}
                            <span style={textMuted}> ({rep.note})</span>
                          </p>
                        )),
                      ),
                    )}
                  </div>
                </section>
              )}

              {stats.actions > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={textMuted}>
                    <Info size={12} strokeWidth={2.5} />
                    Corporate actions
                  </h3>
                  <div className="rounded-lg px-3 py-2.5 space-y-1" style={subtleCard}>
                    {selectedSheets.flatMap((sheet) =>
                      sheet.rows.filter((r) => r.corporate_action).map((row) => (
                        <p key={`${sheet.name}-${row.row_number}`} className="text-[12px]" style={textSecondary}>
                          <span className="font-semibold">{row.ticker || row.raw_description}</span>{" "}
                          {row.corporate_action} · P/L uses values:{" "}
                          {formatCurrency(row.buy_value ?? 0)} → {formatCurrency(row.sell_value ?? 0)}
                        </p>
                      )),
                    )}
                  </div>
                </section>
              )}

              <details>
                <summary className="text-[11px] font-semibold uppercase tracking-wider cursor-pointer" style={textMuted}>
                  First rows to import
                </summary>
                <div className="mt-2 rounded-lg overflow-x-auto" style={subtleCard}>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {["Ticker", "Buy date", "Qty", "Rate", "Value"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider" style={textMuted}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSheets.flatMap((s) => s.rows).slice(0, 8).map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-semibold" style={textPrimary}>
                            {row.ticker || resolved[row.raw_description] || row.raw_description}
                          </td>
                          <td className="px-3 py-1.5 font-mono tabular-nums" style={textSecondary}>{row.buy_date}</td>
                          <td className="px-3 py-1.5 font-mono tabular-nums" style={textSecondary}>{formatNumber(row.qty ?? 0)}</td>
                          <td className="px-3 py-1.5 font-mono tabular-nums" style={textSecondary}>₹{formatNumber(row.buy_rate ?? 0)}</td>
                          <td className="px-3 py-1.5 font-mono tabular-nums" style={textSecondary}>{formatCurrency(row.buy_value ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

          {error && (
            <p
              className="mt-4 text-[12px] px-3 py-2 rounded-lg"
              style={{ color: "var(--color-loss)", backgroundColor: "rgba(244, 63, 94, 0.08)" }}
              role="alert"
            >
              {error}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[12px]" style={textMuted}>
            {done
              ? ""
              : preview
                ? outstanding > 0
                  ? `${outstanding} ticker${outstanding !== 1 ? "s" : ""} still to confirm`
                  : `${stats.holdings + stats.realized} rows ready`
                : "Nothing is saved until you confirm"}
          </p>
          <div className="flex items-center gap-2">
            {done ? (
              <button
                onClick={() => { onSuccess(); onClose() }}
                className="px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110"
                style={primaryButton}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
                  style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                {preview && (
                  <button
                    onClick={commit}
                    disabled={busy || outstanding > 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={primaryButton}
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Import {stats.holdings + stats.realized} rows
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
