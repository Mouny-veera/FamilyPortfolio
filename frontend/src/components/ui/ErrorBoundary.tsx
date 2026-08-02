import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex items-center justify-center min-h-screen p-6" style={{ backgroundColor: "var(--bg-primary)" }}>
        <div
          className="rounded-xl p-8 max-w-md w-full text-center"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="text-3xl mb-4">⚠</div>
          <h2 className="text-[16px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Something went wrong
          </h2>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-muted)" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white cursor-pointer border-none"
            style={{ background: "var(--gradient-accent)", boxShadow: "var(--shadow-accent)" }}
          >
            Reload App
          </button>
        </div>
      </div>
    )
  }
}
