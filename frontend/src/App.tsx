import { useState, useEffect, useCallback } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { HoldingsPage } from "@/components/holdings/HoldingsPage"
import { ScannerPage } from "@/components/scanner/ScannerPage"
import { AlertsPage } from "@/components/alerts/AlertsPage"
import { SettingsPage } from "@/components/settings/SettingsPage"
import { usePolling } from "@/hooks/usePolling"
import { api } from "@/lib/api"

function isMarketHours(): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  )
  const day = parts.weekday
  if (day === "Sat" || day === "Sun") return false
  const time = parseInt(parts.hour) * 60 + parseInt(parts.minute)
  return time >= 9 * 60 + 15 && time <= 15 * 60 + 30
}

export default function App() {
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(isMarketHours)

  const updateRefresh = useCallback(() => {
    setLastRefresh(new Date().toISOString())
  }, [])

  useEffect(() => {
    window.addEventListener("prices-refreshed", updateRefresh)
    return () => window.removeEventListener("prices-refreshed", updateRefresh)
  }, [updateRefresh])

  useEffect(() => {
    const id = setInterval(() => setMarketOpen(isMarketHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  usePolling(
    async () => {
      try {
        await api.refreshPrices()
        window.dispatchEvent(new Event("prices-refreshed"))
      } catch (e) {
        console.error("Auto-refresh failed:", e)
      }
    },
    60_000,
    marketOpen,
  )

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar lastRefresh={lastRefresh} onMenuToggle={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/holdings/:memberId" element={<HoldingsPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
