import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { FileSearch, MapPinned, Moon, ShieldCheck, Sun } from "lucide-react"

type AppShellProps = {
  onSignedOut: () => void
}

export default function AppShell({ onSignedOut }: AppShellProps) {
  const [theme, setTheme] = useState<Theme>(() => readThemePreference())
  const [signingOut, setSigningOut] = useState(false)

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark"
    setTheme(nextTheme)
    applyTheme(nextTheme)
    saveThemePreference(nextTheme)
  }

  async function signOut() {
    setSigningOut(true)
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      })
    } finally {
      setSigningOut(false)
      onSignedOut()
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,oklch(0.98_0.008_245),oklch(0.965_0.006_245))] dark:bg-[linear-gradient(to_bottom,oklch(0.19_0.01_255),oklch(0.17_0.01_255))]">
      <header className="border-b border-border/80 bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 md:px-6">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Permit Workspace
            </p>
            <p className="text-base font-semibold tracking-tight text-foreground">PermitIQ</p>
          </div>
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            {theme === "dark" ? (
              <>
                <Sun className="size-3.5" />
                Light
              </>
            ) : (
              <>
                <Moon className="size-3.5" />
                Dark
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Session
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">Authenticated and ready</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Data Source
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">Tampa GIS + Code index</p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Security
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              OTP-protected access
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:p-5">
          <Tabs defaultValue="code-search">
            <TabsList className="w-full">
              <TabsTrigger value="code-search" className="flex-1">
                <FileSearch className="mr-1 size-3.5" />
                Code Search
              </TabsTrigger>
              <TabsTrigger value="address-review" className="flex-1">
                <MapPinned className="mr-1 size-3.5" />
                Address Review
              </TabsTrigger>
            </TabsList>

            <TabsContent value="code-search" className="mt-6 space-y-3 rounded-xl bg-background/60 p-5">
              <h2 className="text-lg font-semibold leading-[1.25] tracking-tight text-foreground">
                Code Search
              </h2>
              <p className="max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                Ask direct questions about Tampa permit requirements and code provisions.
                Responses are designed for quick review before filing or client updates.
              </p>
              <Badge variant="secondary">Coming in Phase 3</Badge>
            </TabsContent>

            <TabsContent value="address-review" className="mt-6 space-y-3 rounded-xl bg-background/60 p-5">
              <h2 className="text-lg font-semibold leading-[1.25] tracking-tight text-foreground">
                Address Review
              </h2>
              <p className="max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                Enter a Tampa property address to retrieve zoning context and permit-related
                requirements for project planning.
              </p>
              <Badge variant="secondary">Coming in Phase 3</Badge>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
