interface FormErrorProps {
  message: string
}

export function FormError({ message }: FormErrorProps) {
  return (
    <p
      role="alert"
      className="text-[11px] font-medium mb-2 px-2 py-1.5 rounded-md"
      style={{
        color: "var(--color-loss)",
        backgroundColor: "rgba(244, 63, 94, 0.08)",
      }}
    >
      {message}
    </p>
  )
}

interface SubmitButtonProps {
  loading: boolean
  label: string
  loadingLabel: string
  variant?: "accent" | "destructive"
  fullWidth?: boolean
  onClick?: () => void
}

export function SubmitButton({
  loading,
  label,
  loadingLabel,
  variant = "accent",
  fullWidth,
  onClick,
}: SubmitButtonProps) {
  const isDestructive = variant === "destructive"
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={loading}
      className={`${fullWidth ? "w-full" : ""} px-4 py-2 min-h-[44px] lg:min-h-0 rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-all duration-150 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed`}
      style={{
        background: isDestructive
          ? "var(--gradient-destructive)"
          : "var(--gradient-accent)",
        boxShadow: isDestructive
          ? "var(--shadow-destructive)"
          : "var(--shadow-accent)",
      }}
    >
      {loading ? loadingLabel : label}
    </button>
  )
}

export const INLINE_INPUT_CLASSES =
  "w-full px-2.5 py-2.5 lg:py-1.5 min-h-[44px] lg:min-h-0 rounded-lg text-[12px] bg-transparent font-mono tabular-nums transition-all duration-150 outline-none"
