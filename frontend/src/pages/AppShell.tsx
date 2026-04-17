import { Button } from "@/components/ui/button"
import FlagAnswer from "@/components/FlagAnswer"
import { useEffect, useRef, useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import { BookOpen, ChevronDown, FileSearch, MapPinned, Moon, Sun } from "lucide-react"

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
  const [searchRun, setSearchRun] = useState(0)

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
  const [reviewRun, setReviewRun] = useState(0)

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
    setSearchRun((r) => r + 1)

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
    setReviewRun((r) => r + 1)

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

  // Tampa Code tab is full-bleed, handle outside the main layout
  if (activeTab === "tampa-code") {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="shrink-0 border-b border-border bg-card">
          <div className="flex h-[60px] w-full items-center gap-4 px-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Permit Workspace</p>
              <p className="text-base font-bold leading-tight text-foreground">PermitIQ</p>
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={toggleTheme} className="h-8 gap-1.5 px-3 text-xs">
              {theme === "dark" ? <><Sun className="size-3.5" />Light</> : <><Moon className="size-3.5" />Dark</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut} className="h-8 px-3 text-xs">
              {signingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </header>
        <div className="flex flex-1 overflow-hidden gap-4 p-4">
          {/* Sidebar */}
          <nav className="w-[220px] shrink-0 rounded-xl border border-border bg-card p-2 space-y-0.5 self-start">
            <button
              onClick={() => setActiveTab("code-search")}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <FileSearch className="size-4 shrink-0" />
              Code Search
            </button>
            <button
              onClick={() => setActiveTab("address-review")}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <MapPinned className="size-4 shrink-0" />
              Address Review
            </button>
            <button
              onClick={() => setActiveTab("tampa-code")}
              className="flex w-full items-center gap-2.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground"
            >
              <BookOpen className="size-4 shrink-0" />
              Tampa Code
            </button>
          </nav>
          <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
            <iframe
              src={apiUrl("/pdf")}
              title="Tampa Code of Ordinances"
              className="w-full h-full border-0 block"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="flex h-[60px] w-full items-center gap-4 px-6">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Permit Workspace</p>
            <p className="text-base font-bold leading-tight text-foreground">PermitIQ</p>
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={toggleTheme} className="h-8 gap-1.5 px-3 text-xs">
            {theme === "dark" ? <><Sun className="size-3.5" />Light</> : <><Moon className="size-3.5" />Dark</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} disabled={signingOut} className="h-8 px-3 text-xs">
            {signingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </header>

      <div className="px-6 py-4 space-y-4">
        {/* Info cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Session</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Authenticated and ready</p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Data Source</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Tampa GIS + Code index</p>
          </div>
        </div>

        {/* Main layout: sidebar + content */}
        <div className="flex gap-4 items-start">
          {/* Sidebar nav */}
          <nav className="w-[220px] shrink-0 rounded-xl border border-border bg-card p-2 space-y-0.5">
            <button
              onClick={() => setActiveTab("code-search")}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activeTab === "code-search"
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <FileSearch className="size-4 shrink-0" />
              Code Search
            </button>
            <button
              onClick={() => setActiveTab("address-review")}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activeTab === "address-review"
                  ? "bg-accent font-semibold text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <MapPinned className="size-4 shrink-0" />
              Address Review
            </button>
            <button
              onClick={() => setActiveTab("tampa-code")}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <BookOpen className="size-4 shrink-0" />
              Tampa Code
            </button>
          </nav>

          {/* Content panel */}
          <div className="flex-1 rounded-xl border border-border bg-card">

            {/* ── Code Search ── */}
            {activeTab === "code-search" && (
              <div className="p-6 space-y-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Code Search</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ask a question about Tampa building codes and permit requirements.
                    </p>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                    Ready now
                  </span>
                </div>

                {/* Two-column form + results */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Left: input */}
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="question"
                        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        Your question
                      </label>
                      <textarea
                        id="question"
                        className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50"
                        style={{ minHeight: "120px" }}
                        placeholder="What are the setback and height requirements for ADU construction in Tampa?"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            void runCodeSearch()
                          }
                        }}
                        disabled={searchLoading}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">Press ⌘ Enter to search</p>
                      <Button
                        onClick={runCodeSearch}
                        disabled={searchLoading || !question.trim()}
                        size="sm"
                        className="h-8 px-4"
                      >
                        {searchLoading ? "Searching..." : "Run code search"}
                      </Button>
                    </div>
                    {searchError ? (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                        {searchError}
                      </p>
                    ) : null}
                  </div>

                  {/* Right: results */}
                  <div className="space-y-4">
                    {!searchAnswer && !searchResults.length && !searchLoading ? (
                      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
                        <p className="text-sm font-medium text-foreground">Your answer appears here</p>
                        <p className="mt-1.5 max-w-[36ch] text-xs leading-5 text-muted-foreground">
                          Submit a question to see the streamed answer and source excerpts.
                        </p>
                      </div>
                    ) : null}

                    {searchAnswer ? (
                      <div className="rounded-xl border border-border bg-background px-5 py-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Answer</p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{searchAnswer}</p>
                      </div>
                    ) : null}

                    {searchResults.length ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Source excerpts</p>
                        {searchResults.map((result, index) => (
                          <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="rounded-lg border border-border bg-background px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {result.chunk_id ?? "Source chunk"}{result.page ? ` · Page ${result.page}` : ""}
                            </p>
                            <p className="mt-1.5 line-clamp-4 text-sm leading-6 text-foreground">{result.text ?? ""}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!searchLoading && searchAnswer ? (
                      <FlagAnswer key={searchRun} queryType="search" question={question} answerSnippet={searchAnswer} />
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* ── Address Review ── */}
            {activeTab === "address-review" && (
              <div className="p-6 space-y-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Address Review</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter a Tampa property address to retrieve zoning context and permit-related requirements for project planning.
                    </p>
                  </div>
                  <span className="mt-1 shrink-0 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold text-primary">
                    Ready now
                  </span>
                </div>

                {/* Two-column form + results */}
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Left: form */}
                  <div className="space-y-4">
                    {/* Address */}
                    <div>
                      <label
                        htmlFor="address"
                        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        Property address
                      </label>
                      <div ref={addressBoxRef} className="relative">
                        <input
                          id="address"
                          type="text"
                          value={address}
                          onChange={(e) => handleAddressChange(e.target.value)}
                          onFocus={() => { if (addressSuggestions.length > 0) setSuggestOpen(true) }}
                          onKeyDown={handleAddressKeyDown}
                          placeholder="Start typing: 401 E Jackson St"
                          disabled={contextLoading || reviewLoading}
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={suggestOpen}
                          aria-autocomplete="list"
                          aria-controls="address-suggestions"
                          className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        {suggestOpen && addressSuggestions.length > 0 ? (
                          <ul
                            id="address-suggestions"
                            role="listbox"
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
                          >
                            {addressSuggestions.map((s, i) => {
                              const label = s.label ?? s.address ?? ""
                              const active = i === highlightIndex
                              return (
                                <li
                                  key={`${s.magicKey ?? label}-${i}`}
                                  role="option"
                                  aria-selected={active}
                                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                                  onMouseEnter={() => setHighlightIndex(i)}
                                  className={`cursor-pointer px-4 py-2.5 leading-5 ${active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
                                >
                                  {label}
                                </li>
                              )
                            })}
                          </ul>
                        ) : null}
                        {suggestLoading && address.trim().length >= 3 ? (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">Searching Tampa addresses...</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Permit type */}
                    <div>
                      <label
                        htmlFor="permit-type"
                        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        Permit type <span className="font-normal normal-case tracking-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <select
                          id="permit-type"
                          value={permitType}
                          onChange={(e) => setPermitType(e.target.value)}
                          disabled={reviewLoading}
                          className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-4 pr-9 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {PERMIT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Project description */}
                    <div>
                      <label
                        htmlFor="project-description"
                        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        Project description <span className="font-normal normal-case tracking-normal">(optional)</span>
                      </label>
                      <input
                        id="project-description"
                        type="text"
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder="Two-story addition with detached garage"
                        disabled={reviewLoading}
                        className="h-10 w-full rounded-lg border border-input bg-background px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={loadPropertyContext}
                        disabled={contextLoading || !address.trim() || reviewLoading}
                        size="sm"
                        className="h-8 px-4"
                      >
                        {contextLoading ? "Loading..." : "Load property context"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={runAddressReview}
                        disabled={reviewLoading || propertyContext?.x == null || propertyContext?.y == null}
                        size="sm"
                        className="h-8 px-4"
                      >
                        {reviewLoading ? "Reviewing..." : "Run address review"}
                      </Button>
                    </div>

                    {reviewError ? (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                        {reviewError}
                      </p>
                    ) : null}
                  </div>

                  {/* Right: results */}
                  <div className="space-y-4">
                    {!propertyContext && !reviewAnswer && !reviewRequirements.length && !reviewResults.length && !reviewLoading ? (
                      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-8 py-10 text-center">
                        <p className="text-sm font-medium text-foreground">Property context and review results appear here</p>
                        <p className="mt-1.5 max-w-[36ch] text-xs leading-5 text-muted-foreground">
                          Enter an address and load the property context, then run the review to see extracted requirements and source excerpts.
                        </p>
                      </div>
                    ) : null}

                    {propertyContext ? (
                      <div className="rounded-xl border border-border bg-background px-5 py-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Property context</p>
                        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          <div className="flex gap-2"><dt className="w-16 shrink-0 font-medium text-foreground">Address</dt><dd className="text-foreground">{propertyContext.normalized_address ?? address}</dd></div>
                          <div className="flex gap-2"><dt className="w-16 shrink-0 font-medium text-foreground">Zoning</dt><dd className="text-foreground">{propertyContext.zoning ?? "Unavailable"}</dd></div>
                          <div className="flex gap-2"><dt className="w-16 shrink-0 font-medium text-foreground">Overlays</dt><dd className="text-foreground">{(propertyContext.overlays ?? []).length ? (propertyContext.overlays ?? []).join(", ") : "None"}</dd></div>
                          <div className="flex gap-2"><dt className="w-16 shrink-0 font-medium text-foreground">Folio</dt><dd className="text-foreground">{propertyContext.folio ?? "Not matched"}</dd></div>
                        </dl>
                      </div>
                    ) : null}

                    {reviewLoading && !reviewRequirements.length ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-5 py-4 text-sm text-muted-foreground">
                        <span aria-hidden className="inline-block size-2.5 animate-pulse rounded-full bg-primary/70" />
                        Generating review from Tampa code excerpts...
                      </div>
                    ) : null}

                    {reviewRequirements.length ? (
                      <div className="rounded-xl border border-border bg-background overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Code requirements</p>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{reviewRequirements.length} found</span>
                        </div>
                        <div className="overflow-hidden border-t border-border">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs uppercase tracking-[0.06em] text-muted-foreground">
                              <tr>
                                <th className="px-5 py-2.5 font-semibold">Requirement</th>
                                <th className="px-5 py-2.5 font-semibold">Value</th>
                                <th className="w-16 px-5 py-2.5 text-right font-semibold">Page</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {reviewRequirements.map((item, index) => (
                                <tr key={`${item.name ?? "req"}-${index}`} className="align-top even:bg-muted/20">
                                  <td className="px-5 py-2.5 font-medium text-foreground">{item.name ?? "Requirement"}</td>
                                  <td className="px-5 py-2.5 text-foreground">{item.value ?? ""}</td>
                                  <td className="px-5 py-2.5 text-right text-muted-foreground">{item.page ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : reviewAnswer && !reviewLoading && !looksLikeJsonArray(reviewAnswer) ? (
                      <div className="rounded-xl border border-border bg-background px-5 py-4">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Review summary</p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{reviewAnswer}</p>
                      </div>
                    ) : reviewAnswer && !reviewLoading && looksLikeJsonArray(reviewAnswer) ? (
                      <div className="rounded-xl border border-border bg-background px-5 py-4 text-sm text-muted-foreground">
                        No explicit code requirements were extracted. Review the source excerpts below for context.
                      </div>
                    ) : null}

                    {reviewResults.length ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Source excerpts</p>
                        {reviewResults.map((result, index) => (
                          <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="rounded-lg border border-border bg-background px-4 py-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              {result.chunk_id ?? "Source chunk"}{result.page ? ` · Page ${result.page}` : ""}
                            </p>
                            <p className="mt-1.5 line-clamp-4 text-sm leading-6 text-foreground">{result.text ?? ""}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {!reviewLoading && (reviewRequirements.length > 0 || (reviewAnswer && !looksLikeJsonArray(reviewAnswer))) ? (
                      <FlagAnswer
                        key={reviewRun}
                        queryType="address_review"
                        address={address}
                        zoning={propertyContext?.zoning ?? ""}
                        answerSnippet={reviewAnswer || reviewRequirements.map((r) => `${r.name ?? ""}: ${r.value ?? ""}`).join("\n")}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
