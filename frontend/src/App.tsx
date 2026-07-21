import { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { GoogleOAuthProvider } from "@react-oauth/google"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { LoginPage } from "@/components/auth/LoginPage"
import { usePolling } from "@/hooks/usePolling"
import { api } from "@/lib/api"
import {
  AuthContext,
  type AuthUser,
  loadStoredAuth,
  storeAuth,
  clearAuth,
} from "@/lib/auth"

const DashboardPage = lazy(() => import("@/components/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })))
const HoldingsPage = lazy(() => import("@/components/holdings/HoldingsPage").then(m => ({ default: m.HoldingsPage })))
const ScannerPage = lazy(() => import("@/components/scanner/ScannerPage").then(m => ({ default: m.ScannerPage })))
const AlertsPage = lazy(() => import("@/components/alerts/AlertsPage").then(m => ({ default: m.AlertsPage })))
const SettingsPage = lazy(() => import("@/components/settings/SettingsPage").then(m => ({ default: m.SettingsPage })))

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""

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

function AuthenticatedApp() {
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
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium focus:text-white"
        style={{ background: "var(--color-accent, #10B981)" }}
      >
        Skip to main content
      </a>
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar lastRefresh={lastRefresh} onMenuToggle={() => setSidebarOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Suspense fallback={
            <div className="animate-page-enter py-8">
              <div className="h-7 w-32 rounded-md mb-6" style={{ backgroundColor: "var(--bg-elevated)" }} />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <div className="h-3 w-20 rounded mb-3" style={{ backgroundColor: "var(--bg-elevated)" }} />
                    <div className="h-6 w-28 rounded" style={{ backgroundColor: "var(--bg-elevated)" }} />
                  </div>
                ))}
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/holdings/:memberId" element={<HoldingsPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = loadStoredAuth()
    if (stored) {
      setUser(stored.user)
      setToken(stored.token)
    }
    setReady(true)
  }, [])

  const login = async (credential: string) => {
    const res = await api.googleLogin(credential)
    const authUser: AuthUser = { email: res.email, name: res.name, picture: res.picture }
    storeAuth(authUser, res.token)
    setUser(authUser)
    setToken(res.token)
  }

  const logout = () => {
    clearAuth()
    setUser(null)
    setToken(null)
  }

  if (!ready) return null

  const authEnabled = !!GOOGLE_CLIENT_ID

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {authEnabled ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          {user ? (
            <BrowserRouter>
              <AuthenticatedApp />
            </BrowserRouter>
          ) : (
            <LoginPage />
          )}
        </GoogleOAuthProvider>
      ) : (
        <BrowserRouter>
          <AuthenticatedApp />
        </BrowserRouter>
      )}
    </AuthContext.Provider>
  )
}
