import { useEffect, useRef, useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Briefcase,
  ScanSearch,
  Bell,
  Settings,
  ChevronDown,
  User,
  X,
} from "lucide-react"
import { api, type Member } from "@/lib/api"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/holdings", icon: Briefcase, label: "Holdings", expandable: true },
  { to: "/scanner", icon: ScanSearch, label: "Scanner" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/settings", icon: Settings, label: "Settings" },
]

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [holdingsOpen, setHoldingsOpen] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const fetchMembers = () => api.getMembers().then(setMembers).catch(console.error)
    fetchMembers()
    window.addEventListener("members-changed", fetchMembers)
    return () => window.removeEventListener("members-changed", fetchMembers)
  }, [])

  useEffect(() => {
    if (location.pathname.startsWith("/holdings")) {
      setHoldingsOpen(true)
    }
  }, [location.pathname])

  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname
      onMobileClose()
    }
  }, [location.pathname, onMobileClose])

  const sidebarContent = (
    <>
      <div className="px-5 pt-6 pb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
            style={{
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-accent)",
            }}
          >
            FP
          </div>
          <h1 className="text-sm font-semibold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
            Family Portfolio
          </h1>
        </div>
        <button
          onClick={onMobileClose}
          className="p-2.5 -mr-1 rounded-lg cursor-pointer transition-all duration-150 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      <div className="mx-4 mb-3" style={{ borderTop: "1px solid var(--border-subtle)" }} />

      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          if (item.expandable) {
            const isActive = location.pathname.startsWith("/holdings")
            return (
              <div key={item.to}>
                <button
                  onClick={() => setHoldingsOpen(!holdingsOpen)}
                  aria-expanded={holdingsOpen}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-150",
                    isActive
                      ? "text-accent"
                      : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                  )}
                  style={{
                    color: isActive ? undefined : "var(--text-secondary)",
                    backgroundColor: isActive ? "var(--glow-accent)" : undefined,
                  }}
                >
                  <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={cn("transition-transform duration-200", holdingsOpen && "rotate-180")}
                    style={{ color: "var(--text-muted)" }}
                  />
                </button>
                {holdingsOpen && (
                  <div className="ml-[26px] mt-0.5 space-y-0.5 border-l pl-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                    {members.map((m) => (
                      <NavLink
                        key={m.id}
                        to={`/holdings/${m.id}`}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150",
                            isActive
                              ? "text-accent font-medium"
                              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          )
                        }
                        style={({ isActive }) => ({
                          color: isActive ? undefined : "var(--text-secondary)",
                          backgroundColor: isActive ? "var(--glow-accent)" : undefined,
                        })}
                      >
                        <User size={13} strokeWidth={1.5} />
                        {m.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "text-accent"
                    : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                )
              }
              style={({ isActive }) => ({
                color: isActive ? undefined : "var(--text-secondary)",
                backgroundColor: isActive ? "var(--glow-accent)" : undefined,
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                      style={{ backgroundColor: "var(--color-accent)" }}
                    />
                  )}
                  <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-[240px] shrink-0 h-screen sticky top-0 flex-col overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-backdrop-in"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }}
            role="button"
            tabIndex={0}
            aria-label="Close menu"
            onClick={onMobileClose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMobileClose() } }}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[280px] flex flex-col overflow-y-auto animate-slide-in-left"
            style={{
              backgroundColor: "var(--bg-sidebar)",
              borderRight: "1px solid var(--border-color)",
              boxShadow: "4px 0 24px rgba(0, 0, 0, 0.25)",
            }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
