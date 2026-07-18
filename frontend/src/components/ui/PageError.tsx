import { RefreshCw, WifiOff } from "lucide-react"

interface PageErrorProps {
  error: string
  onRetry: () => void
}

export function PageError({ error, onRetry }: PageErrorProps) {
  const isConnectionError =
    error === "Failed to fetch" ||
    error === "NetworkError when attempting to fetch resource."

  return (
    <div className="animate-page-enter flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(244, 63, 94, 0) 100%)",
          border: "1px solid rgba(244, 63, 94, 0.15)",
        }}
      >
        <WifiOff
          size={22}
          strokeWidth={1.5}
          style={{ color: "var(--color-loss)" }}
        />
      </div>
      <div className="text-center max-w-sm">
        <p
          role="alert"
          className="text-[14px] font-semibold tracking-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          {isConnectionError ? "Backend not reachable" : "Something went wrong"}
        </p>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          {isConnectionError
            ? "The backend server isn't running. Start it and try again."
            : error}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all duration-150"
        style={{ background: "var(--gradient-accent)" }}
      >
        <RefreshCw size={13} strokeWidth={2} />
        Retry
      </button>
    </div>
  )
}
