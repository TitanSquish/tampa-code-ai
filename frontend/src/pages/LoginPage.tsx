import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { Building2, Moon, ShieldCheck, Sun } from "lucide-react"

type LoginPageProps = {
  onAuthenticated: () => void
}

export default function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [theme, setTheme] = useState<Theme>(() => readThemePreference())
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [step, setStep] = useState<"request" | "verify">("request")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    applyTheme(nextTheme)
    saveThemePreference(nextTheme)
  }

  async function requestOtp() {
    setLoading(true)
    setError("")
    setMessage("")
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
      setMessage("Code sent. Check your inbox and enter it below.")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    setError("")
    setMessage("")
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,oklch(0.97_0.03_240)_0%,transparent_42%),radial-gradient(circle_at_85%_15%,oklch(0.94_0.04_255)_0%,transparent_36%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top_left,oklch(0.24_0.03_255)_0%,transparent_44%),radial-gradient(circle_at_80%_18%,oklch(0.21_0.05_265)_0%,transparent_38%)]">
      <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1.2fr_0.95fr]">
        <section className="rounded-2xl border border-border/60 bg-card/95 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-primary">
                <Building2 className="size-3.5" />
                Tampa Permit Workspace
              </span>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                PermitIQ
              </h1>
              <p className="max-w-[60ch] text-sm leading-6 text-muted-foreground md:text-base">
                Review zoning and permit requirements with an interface built for quick
                decisions before project submission.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Toggle color theme"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                City Context
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Tampa GIS + Code Base</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Response Mode
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Streamed Requirements
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Sign-In Security
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">Email OTP Verification</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm md:p-7">
          <div className="mb-6 space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Enter your email to receive a one-time access code.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold tracking-wide uppercase">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                className="h-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || step === "verify"}
              />
            </div>
            {step === "verify" && (
              <div className="space-y-2">
                <Label htmlFor="otp" className="text-xs font-semibold tracking-wide uppercase">
                  One-time code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  className="h-10 tracking-[0.22em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            {step === "request" ? (
              <Button className="h-10 w-full font-semibold" onClick={requestOtp} disabled={loading || !email.trim()}>
                {loading ? "Sending code..." : "Send verification code"}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="h-10 w-full font-semibold" onClick={verifyOtp} disabled={loading || !code.trim()}>
                  {loading ? "Verifying..." : "Verify and continue"}
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 w-full"
                  onClick={() => {
                    setStep("request")
                    setCode("")
                    setError("")
                    setMessage("")
                  }}
                  disabled={loading}
                >
                  Edit email address
                </Button>
              </div>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {step === "request"
                ? "You’ll receive a secure code by email."
                : "Use the latest code from your inbox to complete sign-in."}
            </p>
            {message && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Secure sign-in with OTP. No passwords stored.
          </div>
        </section>
      </div>
    </div>
  )
}
