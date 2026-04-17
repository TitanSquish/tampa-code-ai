import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { FileSearch, MapPinned, Moon, Sun } from "lucide-react"

type AppShellProps = {
  onSignedOut: () => void
}

type SearchResult = {
  chunk_id?: string
  page?: number | string
  source?: string
  text?: string
}

type AddressRequirement = {
  category?: string
  requirement?: string
  citation?: string
}

type PropertyContext = {
  normalized_address?: string | null
  zoning?: string | null
  overlays?: string[] | null
  folio?: string | null
  x?: number | null
  y?: number | null
  inside_city?: boolean
  error?: string | null
}

export default function AppShell({ onSignedOut }: AppShellProps) {
  const [theme, setTheme] = useState<Theme>(() => readThemePreference())
  const [signingOut, setSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState("code-search")

  const [question, setQuestion] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchAnswer, setSearchAnswer] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchError, setSearchError] = useState("")

  const [address, setAddress] = useState("")
  const [permitType, setPermitType] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [contextLoading, setContextLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [propertyContext, setPropertyContext] = useState<PropertyContext | null>(null)
  const [reviewAnswer, setReviewAnswer] = useState("")
  const [reviewResults, setReviewResults] = useState<SearchResult[]>([])
  const [reviewRequirements, setReviewRequirements] = useState<AddressRequirement[]>([])
  const [reviewError, setReviewError] = useState("")

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

  async function readNdjsonStream(
    response: Response,
    onMessage: (msg: Record<string, unknown>) => void,
  ) {
    if (!response.body) {
      throw new Error("No response stream available.")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          continue
        }
        onMessage(JSON.parse(trimmed) as Record<string, unknown>)
      }
    }

    const trailing = buffer.trim()
    if (trailing) {
      onMessage(JSON.parse(trailing) as Record<string, unknown>)
    }
  }

  async function runCodeSearch() {
    const q = question.trim()
    if (!q || searchLoading) {
      return
    }

    setSearchLoading(true)
    setSearchError("")
    setSearchAnswer("")
    setSearchResults([])

    try {
      const res = await fetch(apiUrl("/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: q }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setSearchError(data.error ?? "Code search failed.")
        return
      }

      await readNdjsonStream(res, (msg) => {
        if (msg.type === "delta") {
          setSearchAnswer((prev) => prev + String(msg.text ?? ""))
        } else if (msg.type === "sources") {
          setSearchResults(Array.isArray(msg.results) ? (msg.results as SearchResult[]) : [])
        } else if (msg.type === "error") {
          setSearchError(String(msg.text ?? "Search failed."))
        }
      })
    } catch {
      setSearchError("Network error. Please try again.")
    } finally {
      setSearchLoading(false)
    }
  }

  async function loadPropertyContext() {
    const addr = address.trim()
    if (!addr || contextLoading) {
      return
    }

    setContextLoading(true)
    setReviewError("")
    setPropertyContext(null)

    try {
      const res = await fetch(apiUrl("/api/property-context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: addr }),
      })
      const data = (await res.json()) as PropertyContext
      if (!res.ok) {
        setReviewError(data.error ?? "Could not load property context.")
        return
      }
      if (data.error) {
        setReviewError(data.error)
      }
      setPropertyContext(data)
    } catch {
      setReviewError("Network error while loading property context.")
    } finally {
      setContextLoading(false)
    }
  }

  async function runAddressReview() {
    if (reviewLoading || propertyContext?.x == null || propertyContext?.y == null) {
      return
    }

    setReviewLoading(true)
    setReviewError("")
    setReviewAnswer("")
    setReviewResults([])
    setReviewRequirements([])

    try {
      const res = await fetch(apiUrl("/address-review"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          address: address.trim(),
          permit_type: permitType.trim(),
          project_description: projectDescription.trim(),
          x: propertyContext.x,
          y: propertyContext.y,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setReviewError(data.error ?? "Address review failed.")
        return
      }

      await readNdjsonStream(res, (msg) => {
        if (msg.type === "meta") {
          setPropertyContext((prev) => ({
            ...(prev ?? {}),
            normalized_address: (msg.address as string | undefined) ?? prev?.normalized_address,
            zoning: (msg.zoning as string | undefined) ?? prev?.zoning,
            overlays: Array.isArray(msg.overlays) ? (msg.overlays as string[]) : prev?.overlays,
            folio: (msg.folio as string | undefined) ?? prev?.folio,
            inside_city: msg.inside_city as boolean | undefined,
          }))
        } else if (msg.type === "delta") {
          setReviewAnswer((prev) => prev + String(msg.text ?? ""))
        } else if (msg.type === "sources") {
          setReviewResults(Array.isArray(msg.results) ? (msg.results as SearchResult[]) : [])
          setReviewRequirements(
            Array.isArray(msg.requirements) ? (msg.requirements as AddressRequirement[]) : [],
          )
        } else if (msg.type === "error") {
          setReviewError(String(msg.text ?? "Address review failed."))
        }
      })
    } catch {
      setReviewError("Network error. Please try again.")
    } finally {
      setReviewLoading(false)
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
        <section className="mb-6 grid gap-3 md:grid-cols-2">
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
        </section>

        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:p-5">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <Badge variant="default">Ready now</Badge>
              <div className="space-y-3">
                <label
                  htmlFor="question"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Question
                </label>
                <textarea
                  id="question"
                  className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What are the setback and height requirements for ADU construction in Tampa?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  disabled={searchLoading}
                />
                <Button onClick={runCodeSearch} disabled={searchLoading || !question.trim()}>
                  {searchLoading ? "Searching..." : "Run code search"}
                </Button>
              </div>
              {searchError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {searchError}
                </p>
              ) : null}
              {searchAnswer ? (
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Answer
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{searchAnswer}</p>
                </div>
              ) : null}
              {searchResults.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Source excerpts
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((result, index) => (
                      <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="rounded-lg border border-border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {result.chunk_id ?? "Source chunk"}
                          {result.page ? ` | Page ${result.page}` : ""}
                        </p>
                        <p className="mt-1 line-clamp-4 text-sm leading-6 text-foreground">
                          {result.text ?? ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="address-review" className="mt-6 space-y-3 rounded-xl bg-background/60 p-5">
              <h2 className="text-lg font-semibold leading-[1.25] tracking-tight text-foreground">
                Address Review
              </h2>
              <p className="max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                Enter a Tampa property address to retrieve zoning context and permit-related
                requirements for project planning.
              </p>
              <Badge variant="default">Ready now</Badge>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label
                    htmlFor="address"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Property address
                  </label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="401 E Jackson St, Tampa, FL"
                    disabled={contextLoading || reviewLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="permit-type"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Permit type (optional)
                  </label>
                  <Input
                    id="permit-type"
                    value={permitType}
                    onChange={(e) => setPermitType(e.target.value)}
                    placeholder="New single-family home"
                    disabled={reviewLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="project-description"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    Project description (optional)
                  </label>
                  <Input
                    id="project-description"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Two-story with detached garage"
                    disabled={reviewLoading}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={loadPropertyContext} disabled={contextLoading || !address.trim() || reviewLoading}>
                  {contextLoading ? "Loading GIS context..." : "Load property context"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={runAddressReview}
                  disabled={reviewLoading || propertyContext?.x == null || propertyContext?.y == null}
                >
                  {reviewLoading ? "Reviewing..." : "Run address review"}
                </Button>
              </div>
              {propertyContext ? (
                <div className="rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  <p>
                    <strong>Address:</strong>{" "}
                    {propertyContext.normalized_address ?? address}
                  </p>
                  <p>
                    <strong>Zoning:</strong> {propertyContext.zoning ?? "Unavailable"}
                  </p>
                  <p>
                    <strong>Overlays:</strong>{" "}
                    {(propertyContext.overlays ?? []).length
                      ? (propertyContext.overlays ?? []).join(", ")
                      : "None"}
                  </p>
                  <p>
                    <strong>Folio:</strong> {propertyContext.folio ?? "Not matched"}
                  </p>
                </div>
              ) : null}
              {reviewError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {reviewError}
                </p>
              ) : null}
              {reviewAnswer ? (
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Review summary
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{reviewAnswer}</p>
                </div>
              ) : null}
              {reviewRequirements.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Extracted requirements
                  </p>
                  <div className="space-y-2">
                    {reviewRequirements.map((item, index) => (
                      <div key={`${item.category ?? "req"}-${index}`} className="rounded-lg border border-border bg-card p-3">
                        <p className="text-sm font-medium text-foreground">
                          {item.category ?? "Requirement"}
                        </p>
                        <p className="mt-1 text-sm text-foreground">{item.requirement ?? ""}</p>
                        {item.citation ? (
                          <p className="mt-1 text-xs text-muted-foreground">Citation: {item.citation}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {reviewResults.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Source excerpts
                  </p>
                  <div className="space-y-2">
                    {reviewResults.map((result, index) => (
                      <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="rounded-lg border border-border bg-card p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {result.chunk_id ?? "Source chunk"}
                          {result.page ? ` | Page ${result.page}` : ""}
                        </p>
                        <p className="mt-1 line-clamp-4 text-sm leading-6 text-foreground">
                          {result.text ?? ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  )
}
