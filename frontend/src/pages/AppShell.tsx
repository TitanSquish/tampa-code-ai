import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useEffect, useRef, useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { ChevronDown, FileSearch, MapPinned, Moon, Sun } from "lucide-react"

const PERMIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select permit type..." },
  { value: "New single-family home", label: "New single-family home" },
  { value: "New multi-family / apartments", label: "New multi-family / apartments" },
  { value: "New commercial building", label: "New commercial building" },
  { value: "Addition (residential)", label: "Addition (residential)" },
  { value: "Addition (commercial)", label: "Addition (commercial)" },
  { value: "Remodel / alteration (residential)", label: "Remodel / alteration (residential)" },
  { value: "Remodel / alteration (commercial)", label: "Remodel / alteration (commercial)" },
  { value: "Accessory dwelling unit (ADU)", label: "Accessory dwelling unit (ADU)" },
  { value: "Detached garage / accessory structure", label: "Detached garage / accessory structure" },
  { value: "Fence or wall", label: "Fence or wall" },
  { value: "Pool or spa", label: "Pool or spa" },
  { value: "Deck or patio", label: "Deck or patio" },
  { value: "Roofing", label: "Roofing" },
  { value: "Mechanical / HVAC", label: "Mechanical / HVAC" },
  { value: "Electrical", label: "Electrical" },
  { value: "Plumbing", label: "Plumbing" },
  { value: "Solar / PV", label: "Solar / PV" },
  { value: "Sign", label: "Sign" },
  { value: "Demolition", label: "Demolition" },
  { value: "Change of use / occupancy", label: "Change of use / occupancy" },
  { value: "Other", label: "Other" },
]

type AddressSuggestion = {
  label?: string
  address?: string
  magicKey?: string
}

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
  name?: string
  value?: string
  page?: number | string
}

function looksLikeJsonArray(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return trimmed.startsWith("[") || trimmed.startsWith("{")
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

  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const [selectedMagicKey, setSelectedMagicKey] = useState<string | null>(null)
  const suppressNextFetchRef = useRef(false)
  const addressBoxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (suppressNextFetchRef.current) {
      suppressNextFetchRef.current = false
      return
    }

    const q = address.trim()
    if (q.length < 3) {
      setAddressSuggestions([])
      setSuggestOpen(false)
      setSuggestLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const res = await fetch(
          apiUrl(`/api/address-suggest?q=${encodeURIComponent(q)}`),
          { credentials: "include", signal: controller.signal },
        )
        if (!res.ok) {
          setAddressSuggestions([])
          return
        }
        const data = (await res.json()) as unknown
        const list: AddressSuggestion[] = Array.isArray(data)
          ? (data as AddressSuggestion[])
          : []
        setAddressSuggestions(list)
        setHighlightIndex(list.length ? 0 : -1)
        setSuggestOpen(list.length > 0)
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setAddressSuggestions([])
        }
      } finally {
        setSuggestLoading(false)
      }
    }, 180)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [address])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addressBoxRef.current) return
      if (!addressBoxRef.current.contains(e.target as Node)) {
        setSuggestOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function handleAddressChange(value: string) {
    setAddress(value)
    setSelectedMagicKey(null)
  }

  function selectSuggestion(suggestion: AddressSuggestion) {
    const label = suggestion.label ?? suggestion.address ?? ""
    suppressNextFetchRef.current = true
    setAddress(label)
    setSelectedMagicKey(suggestion.magicKey ?? null)
    setSuggestOpen(false)
    setAddressSuggestions([])
    setHighlightIndex(-1)
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || addressSuggestions.length === 0) {
      if (e.key === "ArrowDown" && addressSuggestions.length > 0) {
        setSuggestOpen(true)
      }
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((i) => (i + 1) % addressSuggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex(
        (i) => (i - 1 + addressSuggestions.length) % addressSuggestions.length,
      )
    } else if (e.key === "Enter") {
      if (highlightIndex >= 0 && highlightIndex < addressSuggestions.length) {
        e.preventDefault()
        selectSuggestion(addressSuggestions[highlightIndex])
      }
    } else if (e.key === "Escape") {
      setSuggestOpen(false)
    }
  }

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
        body: JSON.stringify(
          selectedMagicKey
            ? { address: addr, magic_key: selectedMagicKey }
            : { address: addr },
        ),
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-card p-2 shadow-sm">
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
          </div>

          <TabsContent value="code-search" className="mt-0">
            <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8">
              <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border/60 pb-5">
                <div className="flex-1 min-w-[260px] space-y-2">
                  <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground md:text-2xl">
                    Code Search
                  </h2>
                  <p className="max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                    Ask direct questions about Tampa permit requirements and code provisions.
                    Responses are designed for quick review before filing or client updates.
                  </p>
                </div>
                <Badge variant="default">Ready now</Badge>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="question"
                      className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Question
                    </label>
                    <textarea
                      id="question"
                      className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6"
                      placeholder="What are the setback and height requirements for ADU construction in Tampa?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={searchLoading}
                    />
                  </div>
                  <Button
                    onClick={runCodeSearch}
                    disabled={searchLoading || !question.trim()}
                    className="w-full sm:w-auto"
                  >
                    {searchLoading ? "Searching..." : "Run code search"}
                  </Button>
                  {searchError ? (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {searchError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4 lg:col-span-3">
                  {!searchAnswer && !searchResults.length && !searchLoading ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-6 text-center">
                      <p className="text-sm font-medium text-foreground">Your answer appears here</p>
                      <p className="mt-1 max-w-[40ch] text-xs text-muted-foreground">
                        Ask a question on the left to see the streamed answer alongside the
                        source excerpts it was drawn from.
                      </p>
                    </div>
                  ) : null}

                  {searchAnswer ? (
                    <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Answer
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {searchAnswer}
                      </p>
                    </div>
                  ) : null}

                  {searchResults.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Source excerpts
                      </p>
                      <div className="space-y-2">
                        {searchResults.map((result, index) => (
                          <div
                            key={`${result.chunk_id ?? "chunk"}-${index}`}
                            className="rounded-lg border border-border bg-card p-3"
                          >
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
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="address-review" className="mt-0">
            <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8">
              <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border/60 pb-5">
                <div className="flex-1 min-w-[260px] space-y-2">
                  <h2 className="text-xl font-semibold leading-tight tracking-tight text-foreground md:text-2xl">
                    Address Review
                  </h2>
                  <p className="max-w-[70ch] text-sm leading-[1.6] text-muted-foreground">
                    Enter a Tampa property address to retrieve zoning context and permit-related
                    requirements for project planning.
                  </p>
                </div>
                <Badge variant="default">Ready now</Badge>
              </div>

              <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="address"
                      className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Property address
                    </label>
                    <div ref={addressBoxRef} className="relative">
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        onFocus={() => {
                          if (addressSuggestions.length > 0) setSuggestOpen(true)
                        }}
                        onKeyDown={handleAddressKeyDown}
                        placeholder="Start typing: 401 E Jackson St"
                        disabled={contextLoading || reviewLoading}
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={suggestOpen}
                        aria-autocomplete="list"
                        aria-controls="address-suggestions"
                      />
                      {suggestOpen && addressSuggestions.length > 0 ? (
                        <ul
                          id="address-suggestions"
                          role="listbox"
                          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover py-1 text-sm text-popover-foreground shadow-md"
                        >
                          {addressSuggestions.map((s, i) => {
                            const label = s.label ?? s.address ?? ""
                            const active = i === highlightIndex
                            return (
                              <li
                                key={`${s.magicKey ?? label}-${i}`}
                                role="option"
                                aria-selected={active}
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  selectSuggestion(s)
                                }}
                                onMouseEnter={() => setHighlightIndex(i)}
                                className={`cursor-pointer px-3 py-2 leading-5 ${
                                  active
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-accent/60"
                                }`}
                              >
                                {label}
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                      {suggestLoading && address.trim().length >= 3 ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Searching Tampa addresses...
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="permit-type"
                      className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Permit type (optional)
                    </label>
                    <div className="relative">
                      <select
                        id="permit-type"
                        value={permitType}
                        onChange={(e) => setPermitType(e.target.value)}
                        disabled={reviewLoading}
                        className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {PERMIT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden
                        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="project-description"
                      className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
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
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={loadPropertyContext}
                      disabled={contextLoading || !address.trim() || reviewLoading}
                    >
                      {contextLoading ? "Loading GIS context..." : "Load property context"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={runAddressReview}
                      disabled={
                        reviewLoading || propertyContext?.x == null || propertyContext?.y == null
                      }
                    >
                      {reviewLoading ? "Reviewing..." : "Run address review"}
                    </Button>
                  </div>
                  {reviewError ? (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {reviewError}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4 lg:col-span-3">
                  {propertyContext ? (
                    <div className="rounded-xl border border-border bg-background p-4 text-sm leading-6">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Property context
                      </p>
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
                  ) : !reviewAnswer && !reviewRequirements.length && !reviewResults.length ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-6 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Property context and review results appear here
                      </p>
                      <p className="mt-1 max-w-[40ch] text-xs text-muted-foreground">
                        Enter an address and load the property context, then run the review to
                        see extracted requirements and source excerpts.
                      </p>
                    </div>
                  ) : null}

                  {reviewLoading && !reviewRequirements.length ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                      <span
                        aria-hidden
                        className="inline-block size-3 animate-pulse rounded-full bg-primary/70"
                      />
                      Generating review from Tampa code excerpts...
                    </div>
                  ) : null}

                  {reviewRequirements.length ? (
                    <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Code requirements
                        </p>
                        <span className="text-[11px] text-muted-foreground">
                          {reviewRequirements.length} found
                        </span>
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-muted/60 text-xs uppercase tracking-[0.06em] text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Requirement</th>
                              <th className="px-3 py-2 font-semibold">Value</th>
                              <th className="px-3 py-2 font-semibold w-20 text-right">Page</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {reviewRequirements.map((item, index) => (
                              <tr
                                key={`${item.name ?? "req"}-${index}`}
                                className="bg-card/40 align-top"
                              >
                                <td className="px-3 py-2 font-medium text-foreground">
                                  {item.name ?? "Requirement"}
                                </td>
                                <td className="px-3 py-2 text-foreground">
                                  {item.value ?? ""}
                                </td>
                                <td className="px-3 py-2 text-right text-muted-foreground">
                                  {item.page ?? "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : reviewAnswer && !reviewLoading && !looksLikeJsonArray(reviewAnswer) ? (
                    <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Review summary
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {reviewAnswer}
                      </p>
                    </div>
                  ) : reviewAnswer && !reviewLoading && looksLikeJsonArray(reviewAnswer) ? (
                    <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                      No explicit code requirements were extracted from the matched excerpts.
                      Review the source excerpts below for context.
                    </div>
                  ) : null}

                  {reviewResults.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Source excerpts
                      </p>
                      <div className="space-y-2">
                        {reviewResults.map((result, index) => (
                          <div
                            key={`${result.chunk_id ?? "chunk"}-${index}`}
                            className="rounded-lg border border-border bg-card p-3"
                          >
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
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
