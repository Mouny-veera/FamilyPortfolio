import { useState } from "react"
import { RefreshCw, Sun, Moon, Menu, LogOut } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export function TopBar({ lastRefresh, onMenuToggle }: { lastRefresh: string | null; onMenuToggle: () => void }) {
  const { user, logout } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem("theme")
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches
    document.documentElement.classList.toggle("dark", isDark)
    document.documentElement.classList.toggle("light", !isDark)
    return isDark
  })

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    document.documentElement.classList.toggle("light", !next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refreshPrices()
      window.dispatchEvent(new Event("prices-refreshed"))
    } catch (e) {
      console.error("Refresh failed:", e)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <header
      className="h-12 px-4 lg:px-6 flex items-center justify-between shrink-0"
      style={{
        backgroundColor: "var(--bg-primary)",
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <button
        onClick={onMenuToggle}
        className="p-2.5 -ml-1 rounded-lg cursor-pointer transition-all duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:scale-95 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={1.5} style={{ color: "var(--text-primary)" }} />
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-1">
        {lastRefresh && (
          <span
            className="text-[11px] font-mono mr-3 px-2 py-1 rounded-md hidden sm:inline-block"
            style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-elevated)" }}
          >
            {new Date(lastRefresh).toLocaleTimeString("en-IN")}
          </span>
        )}

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Refresh prices"
        >
          <RefreshCw
            size={16}
            strokeWidth={1.5}
            className={refreshing ? "animate-spin" : ""}
            style={{ color: "var(--text-muted)" }}
          />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:scale-95"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <Sun size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          ) : (
            <Moon size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          )}
        </button>

        {user && (
          <button
            onClick={logout}
            className="p-2.5 rounded-lg cursor-pointer transition-all duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] active:scale-95"
            aria-label={`Sign out ${user.name}`}
            title={user.email}
          >
            <LogOut size={16} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
      </div>
    </header>
  )
}
