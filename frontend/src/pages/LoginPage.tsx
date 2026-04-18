import { Button } from "@/components/ui/button"
import { useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { Building2, Moon, Sun } from "lucide-react"

type LoginPageProps = {
  onAuthenticated: () => void
}

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [theme, setTheme] = useState<Theme>(() => readThemePreference())
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"request" | "verify">("request")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    applyTheme(nextTheme)
    saveThemePreference(nextTheme)
  }

  async function requestOtp() {
    if (!email.trim()) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(apiUrl("/api/auth/request-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not send code")
        return
      }
      setStep("verify")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(apiUrl("/api/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Invalid or expired code")
        return
      }
      onAuthenticated()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const form = (
    <div className="w-full max-w-[360px]">
      <div className="mb-7">
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
          Sign in to PermitIQ
        </h2>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          {step === "request"
            ? "Enter the email we sent your invitation to."
            : `We sent a 6-digit code to ${email || "your email"}.`}
        </p>
      </div>

      <div className="space-y-3.5">
        <div>
          <label htmlFor="login-email" className="block text-[11.5px] font-medium mb-1.5 text-foreground">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step === "request") void requestOtp()
            }}
            disabled={loading || step === "verify"}
            autoComplete="email"
            className="w-full h-10 px-3 rounded-[8px] text-[14px] border outline-none transition-colors bg-card text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-[3px] focus:ring-ring/40 disabled:opacity-50"
            style={{ borderColor: step === "verify" ? "var(--border)" : "var(--border-strong)" }}
          />
        </div>

        {step === "verify" && (
          <div>
            <label htmlFor="login-otp" className="block text-[11.5px] font-medium mb-1.5 text-foreground">
              One-time code
            </label>
            <input
              id="login-otp"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length >= 6) void verifyOtp()
              }}
              className="w-full h-11 px-3 rounded-[8px] text-[18px] font-mono tracking-[0.32em] text-center border outline-none transition-colors bg-card text-foreground focus:border-primary focus:ring-[3px] focus:ring-ring/40"
              style={{ borderColor: "var(--border-strong)" }}
            />
            <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted-foreground">
              <span>Expires in 10:00</span>
              <button
                onClick={() => { setStep("request"); setCode(""); setError("") }}
                className="hover:underline text-foreground"
              >
                Use a different email
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] px-3 py-2 text-[12.5px] flex items-center gap-2 bg-destructive/10 text-destructive">
            {error}
          </div>
        )}

        {step === "request" ? (
          <Button
            className="h-10 w-full font-semibold"
            onClick={requestOtp}
            disabled={loading || !email.trim()}
          >
            {loading ? "Sending code…" : "Send sign-in code →"}
          </Button>
        ) : (
          <Button
            className="h-10 w-full font-semibold"
            onClick={verifyOtp}
            disabled={loading || code.length < 6}
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
        )}

        <p className="text-[11.5px] pt-1 text-muted-foreground">
          Access is limited to verified early-trial users.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen grid bg-background lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 border-r border-border bg-card/50">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-[8px] flex items-center justify-center bg-primary text-primary-foreground shrink-0">
            <Building2 className="size-4" />
          </div>
          <span className="font-semibold text-[15px] text-foreground">PermitIQ</span>
        </div>

        {/* Concentric rings mark */}
        <div className="flex items-center justify-center flex-1">
          <div className="relative" style={{ width: 220, height: 220 }}>
            {([220, 160, 100] as const).map((s, i) => (
              <div
                key={s}
                className="absolute rounded-full border border-border"
                style={{
                  width: s,
                  height: s,
                  top: `calc(50% - ${s / 2}px)`,
                  left: `calc(50% - ${s / 2}px)`,
                  opacity: 0.4 + i * 0.2,
                }}
              />
            ))}
            <div
              className="absolute rounded-full flex items-center justify-center bg-primary text-primary-foreground"
              style={{ width: 60, height: 60, top: "calc(50% - 30px)", left: "calc(50% - 30px)" }}
            >
              <Building2 className="size-6" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between text-[11.5px] font-mono text-muted-foreground">
          <span>Early trial · v0.1</span>
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 min-h-screen lg:min-h-0">
        {/* Mobile header */}
        <div className="lg:hidden absolute top-5 left-5 flex items-center gap-2">
          <div className="size-7 rounded-[7px] flex items-center justify-center bg-primary text-primary-foreground">
            <Building2 className="size-3.5" />
          </div>
          <span className="font-semibold text-[14px] text-foreground">PermitIQ</span>
        </div>
        <div className="lg:hidden absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>

        {form}
      </div>
    </div>
  )
}
