import { useState } from "react"
import { GoogleLogin } from "@react-oauth/google"
import { useAuth } from "@/lib/auth"
import { Shield } from "lucide-react"

export function LoginPage() {
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setError("No credential received from Google")
      return
    }
    setLoading(true)
    setError(null)
    try {
      await login(credentialResponse.credential)
    } catch (e: any) {
      setError(e?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 animate-page-enter"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "var(--gradient-accent)",
              boxShadow: "var(--shadow-accent)",
            }}
          >
            <Shield size={26} strokeWidth={1.5} className="text-white" />
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Family Portfolio
          </h1>
          <p
            className="text-[13px] mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Sign in to access your portfolio
          </p>
        </div>

        <div className="flex justify-center">
          {loading ? (
            <div className="flex items-center gap-2 py-3">
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{
                  borderColor: "rgba(16, 185, 129, 0.3)",
                  borderTopColor: "var(--color-profit)",
                }}
              />
              <span
                className="text-[13px]"
                style={{ color: "var(--text-muted)" }}
              >
                Signing in...
              </span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError("Google Sign-In failed. Please try again.")}
              theme="outline"
              size="large"
              width={300}
              text="signin_with"
              shape="rectangular"
            />
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="text-[12px] font-medium mt-4 px-3 py-2 rounded-lg text-center"
            style={{
              color: "var(--color-loss)",
              backgroundColor: "rgba(244, 63, 94, 0.08)",
            }}
          >
            {error}
          </p>
        )}

        <p
          className="text-[11px] text-center mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          Only authorized family members can sign in
        </p>
      </div>
    </div>
  )
}
