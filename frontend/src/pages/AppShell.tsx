import { Button } from "@/components/ui/button"
import FlagAnswer from "@/components/FlagAnswer"
import { useEffect, useRef, useState } from "react"
import { apiUrl } from "@/lib/api"
import { applyTheme, readThemePreference, saveThemePreference, type Theme } from "@/lib/theme"
import {
  AlertCircle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  LogOut,
  MapPin,
  MapPinned,
  Moon,
  Search,
  Sun,
  XCircle,
} from "lucide-react"

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

type PermitLink = { title: string; url: string }

const PERMIT_LINKS: Record<string, PermitLink[]> = {
  "New single-family home": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Residential New Construction Checklist", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "New multi-family / apartments": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "New commercial building": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Addition (residential)": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Addition (commercial)": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Remodel / alteration (residential)": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Remodel / alteration (commercial)": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Accessory dwelling unit (ADU)": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Accessory Dwelling Unit Info — Tampa Gov", url: "https://www.tampagov.net/development-growth-management/accessory-dwelling-units" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Detached garage / accessory structure": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Fence or wall": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Pool or spa": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Deck or patio": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
    { title: "CSD Sufficiency Checklist (PDF)", url: "https://www.tampagov.net/sites/default/files/2025-11/csd-sufficiency-checklist.pdf" },
  ],
  "Roofing": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Mechanical / HVAC": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Electrical": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Plumbing": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Solar / PV": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Sign": [
    { title: "Apply for a Sign Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Demolition": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
  "Change of use / occupancy": [
    { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
    { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
  ],
}

const DEFAULT_PERMIT_LINKS: PermitLink[] = [
  { title: "Apply for a Permit Online", url: "https://www.tampagov.net/online-permits" },
  { title: "Building & Construction — Tampa Gov", url: "https://www.tampagov.net/building-and-construction" },
]

const SUGGESTED_QUESTIONS = [
  "What are the setback and height requirements for an ADU?",
  "How tall can a residential fence be in the front yard?",
  "What's the impervious surface limit in RS-60?",
  "Pool barrier requirements for a backyard pool",
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
  section?: string
  text?: string
}

type TocSubsection = { subsection_number: string; title: string; page: number }
type TocSection    = { section_number: string; title: string; page: number; subsections: TocSubsection[] }
type TocChapter    = { chapter: string; chapter_name: string; source_file: string; sections: TocSection[] }

type SectionContent = {
  section_number: string
  title: string
  page: number
  source_file: string
  chunks: { chunk_id: string; section: string; page: number; text: string }[]
}

type AddressRequirement = {
  name?: string
  value?: string
  page?: number | string
  severity?: string
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

function looksLikeJsonArray(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return trimmed.startsWith("[") || trimmed.startsWith("{")
}

export default function AppShell({ onSignedOut }: AppShellProps) {
  const [theme, setTheme] = useState<Theme>(() => readThemePreference())
  const [signingOut, setSigningOut] = useState(false)
  const [activeTab, setActiveTab] = useState("code-search")
  const [activePdf, setActivePdf] = useState<"pdf1" | "pdf2">("pdf1")

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

  const [toc, setToc] = useState<TocChapter[]>([])
  const [tocLoading, setTocLoading] = useState(false)
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set())
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [sectionContent, setSectionContent] = useState<SectionContent | null>(null)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [tocFilter, setTocFilter] = useState("")
  const tocFetchedRef = useRef(false)
  const municodeUrl = "https://library.municode.com/fl/tampa/codes/code_of_ordinances"

  function renderFormattedChunk(text: string) {
    const lines = text.split("\n")
    return (
      <div className="space-y-2.5 text-[16px] leading-[1.9] text-foreground">
        {lines.map((line, idx) => {
          const trimmed = line.trim()
          if (!trimmed) return <div key={idx} className="h-3" />

          const headerMatch = trimmed.match(/^(Sec\.\s+[\dA-Za-z\-.]+)\s*-\s*(.+)$/)
          if (headerMatch) {
            return (
              <h2 key={idx} className="text-[38px] leading-[1.2] font-semibold tracking-[-0.01em] text-foreground mb-6">
                <span>{headerMatch[1]}</span>
                <span className="font-normal"> - {headerMatch[2]}</span>
              </h2>
            )
          }

          const subHeaderMatch = trimmed.match(/^(\d+-\d+(?:\.\d+)+\.?)\s*(.*)$/)
          if (subHeaderMatch) {
            return (
              <p key={idx} className="italic text-[35px] leading-[1.35] text-foreground/90 mb-4">
                {subHeaderMatch[1]} {subHeaderMatch[2]}
              </p>
            )
          }

          const listMatch = trimmed.match(/^(\d+\.)\s+(.*)$/)
          if (listMatch) {
            return (
              <p key={idx} className="pl-4">
                <span className="inline-block w-10">{listMatch[1]}</span>
                <span>{listMatch[2]}</span>
              </p>
            )
          }

          const ordMatch = trimmed.match(/^\(Ord\..+\)$/)
          if (ordMatch) {
            return <p key={idx} className="mt-5 text-foreground/85">{trimmed}</p>
          }

          const boldLeadMatch = line.match(/^([A-Za-z][^:]{3,80}:)\s*(.*)$/)
          if (boldLeadMatch) {
            return (
              <p key={idx}>
                <strong>{boldLeadMatch[1]}</strong> {boldLeadMatch[2]}
              </p>
            )
          }

          return <p key={idx}>{trimmed}</p>
        })}
      </div>
    )
  }

  // Keyboard shortcuts ⌘1/2/3
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "1") { e.preventDefault(); setActiveTab("code-search") }
        if (e.key === "2") { e.preventDefault(); setActiveTab("address-review") }
        if (e.key === "3") { e.preventDefault(); setActiveTab("tampa-code") }
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

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
        if (!res.ok) { setAddressSuggestions([]); return }
        const data = (await res.json()) as unknown
        const list: AddressSuggestion[] = Array.isArray(data) ? (data as AddressSuggestion[]) : []
        setAddressSuggestions(list)
        setHighlightIndex(list.length ? 0 : -1)
        setSuggestOpen(list.length > 0)
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setAddressSuggestions([])
      } finally {
        setSuggestLoading(false)
      }
    }, 180)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [address])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!addressBoxRef.current) return
      if (!addressBoxRef.current.contains(e.target as Node)) setSuggestOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  useEffect(() => {
    if (activeTab === "tampa-code" && !tocFetchedRef.current) {
      tocFetchedRef.current = true
      fetchToc()
    }
  }, [activeTab])

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
      if (e.key === "ArrowDown" && addressSuggestions.length > 0) setSuggestOpen(true)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((i) => (i + 1) % addressSuggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((i) => (i - 1 + addressSuggestions.length) % addressSuggestions.length)
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
      await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" })
    } finally {
      setSigningOut(false)
      onSignedOut()
    }
  }

  async function readNdjsonStream(
    response: Response,
    onMessage: (msg: Record<string, unknown>) => void,
  ) {
    if (!response.body) throw new Error("No response stream available.")
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        onMessage(JSON.parse(trimmed) as Record<string, unknown>)
      }
    }
    const trailing = buffer.trim()
    if (trailing) onMessage(JSON.parse(trailing) as Record<string, unknown>)
  }

  async function runCodeSearch() {
    const q = question.trim()
    if (!q || searchLoading) return
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
        if (msg.type === "delta") setSearchAnswer((prev) => prev + String(msg.text ?? ""))
        else if (msg.type === "sources") setSearchResults(Array.isArray(msg.results) ? (msg.results as SearchResult[]) : [])
        else if (msg.type === "error") setSearchError(String(msg.text ?? "Search failed."))
      })
    } catch {
      setSearchError("Network error. Please try again.")
    } finally {
      setSearchLoading(false)
    }
  }

  async function fetchToc() {
    setTocLoading(true)
    try {
      const res = await fetch(apiUrl("/api/toc"), { credentials: "include" })
      if (!res.ok) {
        console.error("TOC fetch failed:", res.status, await res.text().catch(() => ""))
        return
      }
      const data = await res.json().catch((err: unknown) => {
        console.error("TOC JSON parse failed:", err)
        return null
      })
      if (Array.isArray(data)) setToc(data as TocChapter[])
    } catch (err) {
      console.error("TOC fetch error:", err)
    } finally {
      setTocLoading(false)
    }
  }

  async function loadSection(rawSection: string) {
    // Normalise any section/subsection string to its parent, e.g. "5-101.1." → "5-101."
    const stripped = rawSection.replace(/\.$/, "")
    const parent   = (stripped.includes(".") ? stripped.split(".")[0] : stripped) + "."
    setActiveSection(parent)
    const chMatch = parent.match(/^(\d+)-/)
    if (chMatch) setExpandedChapters((prev) => new Set([...prev, chMatch[1]]))
    setSectionLoading(true)
    setSectionContent(null)
    try {
      const res = await fetch(apiUrl(`/api/section/${encodeURIComponent(parent)}`), { credentials: "include" })
      if (!res.ok) return
      setSectionContent((await res.json()) as SectionContent)
    } finally {
      setSectionLoading(false)
    }
  }

  function toggleChapter(ch: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      next.has(ch) ? next.delete(ch) : next.add(ch)
      return next
    })
  }

  async function loadPropertyContext() {
    const addr = address.trim()
    if (!addr || contextLoading) return
    setContextLoading(true)
    setReviewError("")
    setPropertyContext(null)
    try {
      const res = await fetch(apiUrl("/api/property-context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          selectedMagicKey ? { address: addr, magic_key: selectedMagicKey } : { address: addr },
        ),
      })
      const data = (await res.json()) as PropertyContext
      if (!res.ok) { setReviewError(data.error ?? "Could not load property context."); return }
      if (data.error) setReviewError(data.error)
      setPropertyContext(data)
    } catch {
      setReviewError("Network error while loading property context.")
    } finally {
      setContextLoading(false)
    }
  }

  async function runAddressReview() {
    if (reviewLoading || propertyContext?.x == null || propertyContext?.y == null) return
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
          setReviewRequirements(Array.isArray(msg.requirements) ? (msg.requirements as AddressRequirement[]) : [])
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

  const NAV_ITEMS = [
    { id: "code-search", label: "Code Search", icon: <FileSearch className="size-4 shrink-0" />, hotkey: "1" },
    { id: "address-review", label: "Address Review", icon: <MapPinned className="size-4 shrink-0" />, hotkey: "2" },
    { id: "tampa-code", label: "Tampa Code", icon: <BookOpen className="size-4 shrink-0" />, hotkey: "3" },
  ]

  const tabLabel = {
    "code-search": "Code Search",
    "address-review": "Address Review",
    "tampa-code": "Tampa Code",
  }[activeTab] ?? ""

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-[232px] shrink-0 flex flex-col border-r border-border bg-card">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 h-[60px] shrink-0 border-b border-border">
          <div className="size-7 rounded-[7px] flex items-center justify-center bg-primary text-primary-foreground shrink-0">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[14px] leading-tight text-foreground">PermitIQ</div>
            <div className="text-[11px] leading-tight text-muted-foreground">Tampa, FL</div>
          </div>
        </div>

        {/* New query */}
        <div className="px-3 pt-3 pb-1.5">
          <Button
            size="sm"
            className="w-full justify-start gap-1.5"
            onClick={() => { setActiveTab("code-search"); setQuestion(""); setSearchAnswer(""); setSearchResults([]) }}
          >
            <Search className="size-3.5" />
            New query
          </Button>
        </div>

        {/* Nav */}
        <nav className="px-2 pt-2 space-y-0.5">
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-[8px] px-2.5 h-9 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span className={active ? "text-primary" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono opacity-40 leading-none">
                  ⌘{item.hotkey}
                </kbd>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto p-3 border-t border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full flex items-center justify-center font-semibold text-[12px] shrink-0 bg-primary/10 text-primary">
              U
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[12.5px] truncate text-foreground">Demo User</div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={signOut}
              disabled={signingOut}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Right: top bar + content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-[60px] shrink-0 flex items-center gap-4 px-6 border-b border-border bg-card">
          <div className="flex items-center gap-1.5 text-[13px]">
            <span className="text-muted-foreground">Workspace</span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{tabLabel}</span>
          </div>

          <div className="flex-1" />

          {/* Backend status pill */}
          <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-full border border-border bg-muted/30 text-[12px]">
            <span className="size-1.5 rounded-full pulse-dot bg-emerald-500" />
            <span className="text-muted-foreground">Backend</span>
            <span className="font-medium text-foreground">Ready</span>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        {/* ── Content ── */}
        <main className="flex-1 overflow-hidden">

          {/* ── Code Search ── */}
          {activeTab === "code-search" && (
            <div className="h-full overflow-y-auto scroll-zone">
              <div className="max-w-[1240px] mx-auto px-8 py-7">
                {/* Page header */}
                <div className="flex items-start justify-between gap-6 mb-6">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">
                      <Search className="size-3.5 text-primary" />
                      Natural-language RAG
                    </div>
                    <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Code Search</h1>
                    <p className="mt-1 text-[14px] max-w-[64ch] text-muted-foreground">
                      Ask anything about Tampa building codes and permit requirements. Answers stream from the Tampa Code of Ordinances with exact clause citations.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)" }}>
                  {/* Left: form */}
                  <div className="space-y-4">
                    {/* Textarea card */}
                    <div className="rounded-[12px] border border-border bg-card p-1.5">
                      <textarea
                        className="w-full resize-none rounded-[10px] px-4 py-3 text-[14px] leading-6 border-0 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                        style={{ minHeight: 132 }}
                        placeholder="e.g. What are the setback and height requirements for an ADU in RS-60?"
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
                      <div className="flex items-center justify-between px-2 pt-1 pb-1">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span>Press</span>
                          <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted border border-border font-mono leading-none">⌘</kbd>
                          <kbd className="px-1 py-0.5 rounded text-[10px] bg-muted border border-border font-mono leading-none">↵</kbd>
                          <span>to search</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{question.length} / 800</span>
                          <Button
                            size="sm"
                            onClick={runCodeSearch}
                            disabled={!question.trim() || searchLoading}
                          >
                            {searchLoading ? "Searching…" : "Run search →"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Suggested questions */}
                    {!searchAnswer && !searchLoading && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2 text-muted-foreground">
                          Try a question
                        </div>
                        <div className="space-y-1.5">
                          {SUGGESTED_QUESTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setQuestion(s)}
                              className="w-full text-left rounded-[8px] px-3.5 py-2.5 text-[13px] border border-border bg-card hover:border-border-strong transition-colors flex items-center justify-between gap-2 group text-foreground"
                            >
                              <span>{s}</span>
                              <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Retrieval metadata */}
                    {(searchLoading || searchAnswer) && (
                      <div className="rounded-[10px] border border-border bg-card p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2.5 text-muted-foreground">
                          Retrieval
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[12px]">
                          {[
                            ["Model", "gpt-4o-mini"],
                            ["Embed", "text-embedding-3-small"],
                            ["k", "10 chunks"],
                            ["Multi-query", "Enabled (n=3)"],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <div className="text-muted-foreground">{k}</div>
                              <div className="font-mono mt-0.5 text-foreground">{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchError && (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                        {searchError}
                      </p>
                    )}
                  </div>

                  {/* Right: result */}
                  <div className="space-y-4">
                    {!searchAnswer && !searchResults.length && !searchLoading ? (
                      <div className="rounded-[12px] border border-dashed border-border bg-card/50 px-8 py-16 text-center">
                        <div className="mx-auto size-12 rounded-full flex items-center justify-center mb-4 bg-primary/10 text-primary">
                          <Search className="size-5" />
                        </div>
                        <div className="font-medium text-[15px] text-foreground">Your answer appears here</div>
                        <div className="mt-1.5 max-w-[42ch] mx-auto text-[13px] text-muted-foreground">
                          Submit a question to see the streamed answer and every source excerpt it was grounded in.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Answer card */}
                        <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-1.5 rounded-full pulse-dot ${searchLoading ? "bg-primary" : "bg-emerald-500"}`}
                              />
                              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {searchLoading ? "Streaming answer" : "Answer"}
                              </span>
                            </div>
                            {!searchLoading && searchAnswer && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Copy answer"
                                onClick={() => navigator.clipboard?.writeText(searchAnswer)}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            )}
                          </div>

                          <div className="px-6 py-5 text-[14.5px] leading-[1.65] text-foreground" style={{ maxWidth: "72ch" }}>
                            <span className="whitespace-pre-wrap">{searchAnswer}</span>
                            {searchLoading && <span className="stream-cursor" />}
                          </div>

                          {!searchLoading && searchAnswer && (
                            <div className="px-5 py-2.5 border-t border-border bg-muted/20">
                              <FlagAnswer
                                key={searchRun}
                                queryType="search"
                                question={question}
                                answerSnippet={searchAnswer}
                              />
                            </div>
                          )}
                        </div>

                        {/* Sources */}
                        {searchResults.length > 0 && (
                          <div className="rounded-[12px] border border-border bg-card">
                            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Source excerpts
                              </span>
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                                {searchResults.length}
                              </span>
                            </div>
                            <div className="divide-y divide-border">
                              {searchResults.map((result, index) => (
                                <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="px-5 py-3.5 flex gap-3">
                                  <div className="shrink-0 size-6 rounded-md flex items-center justify-center text-[11px] font-semibold font-mono bg-primary/10 text-primary">
                                    {index + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="font-mono text-[11.5px] font-medium text-foreground">
                                        {result.chunk_id ?? "Source chunk"}
                                      </span>
                                      {result.page && (
                                        <span className="text-[11px] text-muted-foreground">· Page {result.page}</span>
                                      )}
                                    </div>
                                    <p className="text-[13px] leading-[1.55] text-muted-foreground line-clamp-4">
                                      {result.text ?? ""}
                                    </p>
                                    {result.section && (
                                      <button
                                        onClick={() => { loadSection(result.section!); setActiveTab("tampa-code") }}
                                        className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline"
                                      >
                                        <BookOpen className="size-3 shrink-0" />
                                        Open in code browser
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Address Review ── */}
          {activeTab === "address-review" && (
            <div className="h-full overflow-y-auto scroll-zone">
              <div className="max-w-[1240px] mx-auto px-8 py-7">
                {/* Page header */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">
                    <MapPinned className="size-3.5 text-primary" />
                    Parcel-grounded requirements
                  </div>
                  <h1 className="text-[26px] font-semibold tracking-tight text-foreground">Address Review</h1>
                  <p className="mt-1 text-[14px] max-w-[64ch] text-muted-foreground">
                    Enter a Tampa property and project type. PermitIQ pulls zoning, overlays, and parcel data from the City ArcGIS, then extracts the specific code requirements for your scope.
                  </p>
                </div>

                <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,420px) minmax(0,1fr)" }}>
                  {/* Left: form */}
                  <div className="space-y-4">
                    {/* Address with pin icon */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                        Property address
                      </label>
                      <div ref={addressBoxRef} className="relative">
                        <div className="flex items-center h-10 rounded-[9px] border px-3 gap-2 focus-within:border-primary transition-colors bg-card"
                          style={{ borderColor: "var(--border-strong)" }}>
                          <MapPin className="size-4 text-muted-foreground shrink-0" />
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => handleAddressChange(e.target.value)}
                            onFocus={() => { if (addressSuggestions.length > 0) setSuggestOpen(true) }}
                            onKeyDown={handleAddressKeyDown}
                            placeholder="401 E Jackson St"
                            disabled={contextLoading || reviewLoading}
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={suggestOpen}
                            aria-autocomplete="list"
                            aria-controls="address-suggestions"
                            className="flex-1 outline-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                          />
                          {selectedMagicKey && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              ✓ Matched
                            </span>
                          )}
                        </div>
                        {suggestOpen && addressSuggestions.length > 0 && (
                          <ul
                            id="address-suggestions"
                            role="listbox"
                            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-[9px] border border-border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
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
                                  className="flex items-center gap-2 px-3 h-9 cursor-pointer transition-colors"
                                  style={{
                                    background: active ? "var(--primary-soft)" : "transparent",
                                    color: active ? "var(--primary-soft-fg)" : "var(--foreground)",
                                  }}
                                >
                                  <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-[13.5px]">{label}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {suggestLoading && address.trim().length >= 3 && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            Powered by Tampa ArcGIS autocomplete…
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Permit type */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                        Permit type <span className="font-normal normal-case">(optional)</span>
                      </label>
                      <div className="relative">
                        <select
                          value={permitType}
                          onChange={(e) => setPermitType(e.target.value)}
                          disabled={reviewLoading}
                          className="w-full h-10 rounded-[9px] px-3 pr-8 text-[14px] appearance-none border outline-none transition-colors bg-card text-foreground disabled:opacity-50"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          {PERMIT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Project description */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
                        Project description <span className="font-normal normal-case">(optional)</span>
                      </label>
                      <textarea
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder="e.g. 2-story addition with detached garage, 1,200 sqft"
                        disabled={reviewLoading}
                        className="w-full rounded-[9px] px-3 py-2.5 text-[14px] leading-6 border resize-none outline-none transition-colors bg-card text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                        style={{ borderColor: "var(--border-strong)", minHeight: 86 }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPropertyContext}
                        disabled={contextLoading || !address.trim() || reviewLoading}
                        className="flex-1"
                      >
                        {contextLoading
                          ? "Loading…"
                          : propertyContext
                          ? "✓ Context loaded"
                          : "Load property context"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={runAddressReview}
                        disabled={reviewLoading || propertyContext?.x == null || propertyContext?.y == null}
                        className="flex-1"
                      >
                        {reviewLoading ? "Reviewing…" : "Run review →"}
                      </Button>
                    </div>

                    {reviewError && (
                      <p className="rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                        {reviewError}
                      </p>
                    )}
                  </div>

                  {/* Right: results */}
                  <div className="space-y-4">
                    {/* Property context — empty state */}
                    {!propertyContext && !contextLoading && (
                      <div className="rounded-[12px] border border-dashed border-border bg-card/50 px-6 py-12 text-center">
                        <div className="mx-auto size-10 rounded-full flex items-center justify-center mb-3 bg-primary/10 text-primary">
                          <MapPin className="size-5" />
                        </div>
                        <div className="font-medium text-[14px] text-foreground">Property context appears here</div>
                        <div className="mt-1 max-w-[42ch] mx-auto text-[12.5px] text-muted-foreground">
                          Load a Tampa address to see zoning, overlays, folio, and parcel details pulled from City GIS.
                        </div>
                      </div>
                    )}

                    {/* Property context — loading skeleton */}
                    {contextLoading && (
                      <div className="rounded-[12px] border border-border bg-card p-5 space-y-3">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" fill="none" strokeDasharray="40 20" />
                          </svg>
                          Querying Tampa ArcGIS…
                        </div>
                        {[80, 65, 90, 55].map((w, i) => (
                          <div key={i} className="h-4 rounded stripe-placeholder" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    )}

                    {/* Property context — data card */}
                    {propertyContext && (
                      <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
                          <div className="flex items-center gap-2">
                            <MapPin className="size-3.5 text-primary" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Property context
                            </span>
                            {propertyContext.inside_city && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                ✓ Inside city
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2">
                          {/* Map placeholder */}
                          <div className="relative stripe-placeholder border-r border-border" style={{ minHeight: 180 }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                              <div className="size-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                                <MapPin className="size-4" />
                              </div>
                              {propertyContext.x != null && propertyContext.y != null && (
                                <div className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-card text-muted-foreground border border-border">
                                  {propertyContext.y?.toFixed(4)}° N, {Math.abs(propertyContext.x ?? 0).toFixed(4)}° W
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Property details */}
                          <div className="p-4 space-y-3">
                            <div>
                              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Address</div>
                              <div className="mt-0.5 text-[13px] font-medium text-foreground">
                                {propertyContext.normalized_address ?? address}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Zoning</div>
                              <div className="mt-0.5 text-[13px] font-mono text-foreground">
                                {propertyContext.zoning ?? "Unavailable"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Overlays</div>
                              {(propertyContext.overlays ?? []).length > 0 ? (
                                <div className="flex gap-1.5 flex-wrap">
                                  {(propertyContext.overlays ?? []).map((o) => (
                                    <span key={o} className="inline-flex items-center rounded-full px-2 py-[1px] text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                                      {o}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[13px] text-muted-foreground">None</span>
                              )}
                            </div>
                            <div>
                              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Folio</div>
                              <div className="mt-0.5 text-[12.5px] font-mono text-foreground">
                                {propertyContext.folio ?? "Not matched"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Review streaming */}
                    {(reviewLoading || reviewAnswer) && (
                      <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
                          <span
                            className={`size-1.5 rounded-full pulse-dot ${reviewLoading ? "bg-primary" : "bg-emerald-500"}`}
                          />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            {reviewLoading ? "Generating review" : "Review summary"}
                          </span>
                        </div>
                        <div className="px-5 py-4 text-[14px] leading-[1.6] text-foreground" style={{ maxWidth: "72ch" }}>
                          {!looksLikeJsonArray(reviewAnswer) && <span className="whitespace-pre-wrap">{reviewAnswer}</span>}
                          {reviewLoading && <span className="stream-cursor" />}
                          {!reviewLoading && looksLikeJsonArray(reviewAnswer) && (
                            <span className="text-muted-foreground text-sm">No explicit code requirements were extracted. Review the source excerpts below for context.</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Permit Required callout */}
                    {(() => {
                      const permitItem = reviewRequirements.find((r) => r.name === "Permit Required")
                      if (!permitItem) return null
                      const val = (permitItem.value ?? "").toLowerCase()
                      const isNo = val.startsWith("no")
                      const isLikely = val.startsWith("likely")
                      return (
                        <div className={`rounded-[12px] border px-5 py-4 flex gap-3 items-start ${
                          isNo
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : isLikely
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-primary/30 bg-primary/5"
                        }`}>
                          <div className="shrink-0 mt-0.5">
                            {isNo
                              ? <XCircle className="size-4 text-emerald-500" />
                              : isLikely
                              ? <AlertCircle className="size-4 text-amber-500" />
                              : <CheckCircle2 className="size-4 text-primary" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className={`text-[12px] font-semibold uppercase tracking-[0.08em] mb-1 ${
                              isNo ? "text-emerald-600 dark:text-emerald-400" : isLikely ? "text-amber-600 dark:text-amber-400" : "text-primary"
                            }`}>
                              {isNo ? "Permit Not Required" : isLikely ? "Permit Likely Required" : "Permit Required"}
                            </div>
                            <p className="text-[13.5px] leading-[1.55] text-foreground">{permitItem.value}</p>
                            {permitItem.page && Number(permitItem.page) > 0 && (
                              <span className="text-[11.5px] text-muted-foreground mt-1 block">Source: p.{permitItem.page}</span>
                            )}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Required Documents card */}
                    {(() => {
                      const docsItem = reviewRequirements.find((r) => r.name === "Required Documents")
                      if (!docsItem) return null
                      const docs = (docsItem.value ?? "").split(",").map((d) => d.trim()).filter(Boolean)
                      return (
                        <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
                            <FileText className="size-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Required Documents
                            </span>
                            {docsItem.page && Number(docsItem.page) > 0 && (
                              <span className="text-[11px] text-muted-foreground ml-auto">p.{docsItem.page}</span>
                            )}
                          </div>
                          <ul className="divide-y divide-border">
                            {docs.map((doc, i) => (
                              <li key={i} className="px-5 py-2.5 flex items-center gap-2.5 text-[13.5px] text-foreground">
                                <span className="size-1.5 rounded-full bg-primary/50 shrink-0" />
                                {doc}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}

                    {/* Requirements table */}
                    {(() => {
                      const codeReqs = reviewRequirements.filter(
                        (r) => r.name !== "Permit Required" && r.name !== "Required Documents"
                      )
                      if (codeReqs.length === 0) return null
                      return (
                        <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-2.5 border-b border-border">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Code requirements
                              </span>
                              <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                                {codeReqs.length}
                              </span>
                            </div>
                          </div>
                          <table className="w-full text-left text-[13.5px]">
                            <thead>
                              <tr className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground border-b border-border bg-muted/30">
                                <th className="px-5 py-2 font-semibold">Requirement</th>
                                <th className="px-5 py-2 font-semibold">Value</th>
                                <th className="px-5 py-2 font-semibold">Page</th>
                                <th className="px-5 py-2 font-semibold text-right">Note</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {codeReqs.map((item, index) => (
                                <tr key={`${item.name ?? "req"}-${index}`} className="align-middle" style={index % 2 ? { background: "var(--card-2)" } : {}}>
                                  <td className="px-5 py-2.5 font-medium text-foreground">{item.name ?? "Requirement"}</td>
                                  <td className="px-5 py-2.5">
                                    <span className="font-mono text-[12.5px] text-foreground">{item.value ?? ""}</span>
                                  </td>
                                  <td className="px-5 py-2.5">
                                    <span className="font-mono text-[11.5px] text-muted-foreground">
                                      {item.page ? `p.${item.page}` : "—"}
                                    </span>
                                  </td>
                                  <td className="px-5 py-2.5 text-right">
                                    {item.severity === "alert" && (
                                      <span className="inline-flex items-center rounded-full px-2 py-[1px] text-[11px] font-medium bg-destructive/10 text-destructive">
                                        Review required
                                      </span>
                                    )}
                                    {item.severity === "watch" && (
                                      <span className="inline-flex items-center rounded-full px-2 py-[1px] text-[11px] font-medium text-[var(--accent-warm-fg)]" style={{ background: "var(--accent-warm-soft)" }}>
                                        Verify
                                      </span>
                                    )}
                                    {(!item.severity || item.severity === "standard") && (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}

                    {/* City Resources */}
                    {permitType && reviewRequirements.length > 0 && !reviewLoading && (
                      <div className="rounded-[12px] border border-border bg-card overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            City of Tampa resources
                          </span>
                        </div>
                        <ul className="divide-y divide-border">
                          {(PERMIT_LINKS[permitType] ?? DEFAULT_PERMIT_LINKS).map((link, i) => (
                            <li key={i}>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 flex items-center gap-2.5 text-[13.5px] text-primary hover:underline"
                              >
                                <ExternalLink className="size-3.5 shrink-0" />
                                {link.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Source excerpts */}
                    {reviewResults.length > 0 && (
                      <div className="rounded-[12px] border border-border bg-card">
                        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Source excerpts
                          </span>
                          <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                            {reviewResults.length}
                          </span>
                        </div>
                        <div className="divide-y divide-border">
                          {reviewResults.map((result, index) => (
                            <div key={`${result.chunk_id ?? "chunk"}-${index}`} className="px-5 py-3.5 flex gap-3">
                              <div className="shrink-0 size-6 rounded-md flex items-center justify-center text-[11px] font-semibold font-mono bg-primary/10 text-primary">
                                {index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-mono text-[11.5px] font-medium text-foreground">
                                    {result.chunk_id ?? "Source chunk"}
                                  </span>
                                  {result.page && (
                                    <span className="text-[11px] text-muted-foreground">· Page {result.page}</span>
                                  )}
                                </div>
                                <p className="text-[13px] leading-[1.55] text-muted-foreground line-clamp-4">
                                  {result.text ?? ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!reviewLoading && (reviewRequirements.length > 0 || (reviewAnswer && !looksLikeJsonArray(reviewAnswer))) && (
                      <FlagAnswer
                        key={reviewRun}
                        queryType="address_review"
                        address={address}
                        zoning={propertyContext?.zoning ?? ""}
                        answerSnippet={reviewAnswer || reviewRequirements.map((r) => `${r.name ?? ""}: ${r.value ?? ""}`).join("\n")}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tampa Code ── */}
          {activeTab === "tampa-code" && (() => {
            const isFiltering = tocFilter.trim().length > 0
            const filteredToc = isFiltering
              ? toc
                  .map((ch) => ({
                    ...ch,
                    sections: ch.sections.filter(
                      (s) =>
                        s.section_number.toLowerCase().includes(tocFilter.toLowerCase()) ||
                        s.title.toLowerCase().includes(tocFilter.toLowerCase()),
                    ),
                  }))
                  .filter((ch) => ch.sections.length > 0)
              : toc

            return (
              <div className="h-full" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)" }}>

                {/* ── Sidebar ── */}
                <div className="border-r border-border flex flex-col bg-card h-full overflow-hidden">
                  <div className="px-3 py-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Globe2 className="size-4" />
                      </div>
                      <div>
                        <div className="text-[12px] font-semibold text-foreground">Municode Viewer</div>
                        <div className="text-[11px] text-muted-foreground">Official Tampa code library</div>
                      </div>
                    </div>
                    <a
                      href={municodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                    >
                      Open full Municode site
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  {/* Filter */}
                  <div className="px-3 py-2.5 border-b border-border shrink-0">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <input
                        value={tocFilter}
                        onChange={(e) => setTocFilter(e.target.value)}
                        placeholder="Filter sections…"
                        className="w-full h-8 pl-8 pr-3 text-[13px] rounded-[7px] border bg-background text-foreground placeholder:text-muted-foreground outline-none transition-colors"
                        style={{ borderColor: "var(--border)" }}
                      />
                    </div>
                  </div>

                  {/* Tree */}
                  <div className="flex-1 overflow-y-auto scroll-zone py-1">
                    {tocLoading && (
                      <div className="px-4 py-3 text-[12.5px] text-muted-foreground">Loading…</div>
                    )}
                    {!tocLoading && toc.length === 0 && (
                      <div className="px-4 py-3 text-[12.5px] text-muted-foreground">Could not load sections. Restart the backend and reload.</div>
                    )}
                    {!tocLoading && filteredToc.length === 0 && toc.length > 0 && (
                      <div className="px-4 py-3 text-[12.5px] text-muted-foreground">No sections match.</div>
                    )}
                    {filteredToc.map((chapter) => {
                      const isOpen = isFiltering || expandedChapters.has(chapter.chapter)
                      return (
                        <div key={chapter.chapter}>
                          <button
                            onClick={() => toggleChapter(chapter.chapter)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                          >
                            <ChevronRight
                              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                            />
                            <div className="min-w-0">
                              <div className="text-[11.5px] font-semibold text-foreground leading-tight">
                                Ch. {chapter.chapter}{chapter.chapter_name ? ` — ${chapter.chapter_name}` : ""}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{chapter.source_file}</div>
                            </div>
                          </button>

                          {isOpen && (
                            <div>
                              {chapter.sections.map((section) => (
                                <button
                                  key={section.section_number}
                                  onClick={() => loadSection(section.section_number)}
                                  className="w-full text-left transition-colors hover:bg-muted/40"
                                  style={{
                                    background: activeSection === section.section_number ? "var(--primary-soft)" : undefined,
                                    color: activeSection === section.section_number ? "var(--primary-soft-fg)" : undefined,
                                  }}
                                >
                                  <div className="pl-7 pr-3 py-1.5">
                                    <span className="font-mono text-[10.5px] mr-1.5 opacity-60">{section.section_number}</span>
                                    <span className="text-[12px]">{section.title || "—"}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Content pane ── */}
                <div className="h-full overflow-y-auto scroll-zone">
                  {!activeSection && !sectionLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <BookOpen className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                        <div className="text-[14px] text-muted-foreground">Select a section from the sidebar to read the code</div>
                      </div>
                    </div>
                  )}

                  {sectionLoading && (
                    <div className="px-10 py-8 max-w-[780px] space-y-3">
                      {[90, 75, 85, 60, 95, 70].map((w, i) => (
                        <div key={i} className="h-4 rounded stripe-placeholder" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}

                  {sectionContent && !sectionLoading && (
                    <div className="px-10 py-7 max-w-[820px]">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1 flex-wrap">
                        <span>Ch. {sectionContent.section_number.match(/^(\d+)/)?.[1]}</span>
                        <ChevronRight className="size-3 shrink-0" />
                        <span className="font-mono">{sectionContent.section_number}</span>
                        {sectionContent.title && (
                          <>
                            <ChevronRight className="size-3 shrink-0" />
                            <span>{sectionContent.title}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground mb-7">
                        Page {sectionContent.page} · {sectionContent.source_file}
                      </div>

                      {/* Chunks */}
                      <div className="space-y-7">
                        {sectionContent.chunks.map((chunk, i) => (
                          <div key={chunk.chunk_id || i}>
                            {chunk.section !== activeSection && (
                              <div className="font-mono text-[10.5px] text-muted-foreground mb-2 uppercase tracking-wider">
                                {chunk.section}
                              </div>
                            )}
                            {renderFormattedChunk(chunk.text)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          })()}

        </main>
      </div>
    </div>
  )
}
