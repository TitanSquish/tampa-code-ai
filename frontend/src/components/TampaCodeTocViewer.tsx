import { ChevronDown, ChevronRight, ExternalLink, FileText, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { apiUrl } from "@/lib/api"

type TocSubsection = { subsection_number: string; title: string; page: number }
type TocSection = { section_number: string; title: string; page: number; subsections: TocSubsection[] }
type TocChapter = { chapter: string; chapter_name: string; source_file: string; sections: TocSection[] }

type SectionContent = {
  section_number: string
  title: string
  page: number
  source_file: string
  chunks: { chunk_id: string; section: string; page: number; text: string }[]
}

const municodeUrl = "https://library.municode.com/fl/tampa/codes/code_of_ordinances"

function sortByPage<T extends { page?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.page || Number.MAX_SAFE_INTEGER) - (b.page || Number.MAX_SAFE_INTEGER))
}

export default function TampaCodeTocViewer() {
  const [query, setQuery] = useState("")
  const [toc, setToc] = useState<TocChapter[]>([])
  const [loadingToc, setLoadingToc] = useState(true)
  const [tocError, setTocError] = useState("")

  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({})
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [sectionContent, setSectionContent] = useState<SectionContent | null>(null)
  const [sectionLoading, setSectionLoading] = useState(false)
  const [sectionError, setSectionError] = useState("")

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoadingToc(true)
      setTocError("")
      try {
        const res = await fetch(apiUrl("/api/toc"), { credentials: "include" })
        if (!res.ok) throw new Error(`Failed to load TOC (${res.status})`)
        const data = (await res.json()) as TocChapter[]
        if (ignore) return
        setToc(data)
        const chapterState: Record<string, boolean> = {}
        data.forEach((chapter, idx) => {
          chapterState[chapter.chapter] = idx < 2
        })
        setOpenChapters(chapterState)
      } catch (error) {
        if (!ignore) setTocError(error instanceof Error ? error.message : "Unable to load Tampa code TOC")
      } finally {
        if (!ignore) setLoadingToc(false)
      }
    }
    load()
    return () => {
      ignore = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return toc
    return toc
      .map((chapter) => {
        const chapterMatch = `${chapter.chapter} ${chapter.chapter_name}`.toLowerCase().includes(q)
        const filteredSections = chapter.sections
          .map((section) => {
            const sectionHit = `${section.section_number} ${section.title}`.toLowerCase().includes(q)
            const subs = section.subsections.filter((sub) => `${sub.subsection_number} ${sub.title}`.toLowerCase().includes(q))
            if (sectionHit || subs.length || chapterMatch) return { ...section, subsections: subs.length || sectionHit || chapterMatch ? section.subsections : subs }
            return null
          })
          .filter(Boolean) as TocSection[]

        if (chapterMatch || filteredSections.length) return { ...chapter, sections: filteredSections }
        return null
      })
      .filter(Boolean) as TocChapter[]
  }, [query, toc])

  async function loadSection(sectionNumber: string) {
    const key = sectionNumber.replace(/\.$/, "")
    setSelectedSectionId(key)
    setSectionError("")
    setSectionLoading(true)
    try {
      const res = await fetch(apiUrl(`/api/section/${encodeURIComponent(key)}`), { credentials: "include" })
      if (!res.ok) throw new Error(`Failed to load section (${res.status})`)
      setSectionContent((await res.json()) as SectionContent)
    } catch (error) {
      setSectionContent(null)
      setSectionError(error instanceof Error ? error.message : "Unable to load section text")
    } finally {
      setSectionLoading(false)
    }
  }

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="border-r border-border bg-card h-full overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Tampa Code</h2>
          <p className="text-xs text-muted-foreground mt-1">Browse by chapter → section → subsection and open full extracted section text.</p>
          <a href={municodeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Open official Tampa Municode <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="p-3 border-b border-border relative">
          <Search className="size-3.5 text-muted-foreground absolute left-5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapters, sections..." className="w-full h-8 pl-8 pr-2 text-xs rounded border bg-background" />
        </div>

        {loadingToc ? <p className="p-3 text-xs text-muted-foreground">Loading Tampa code table of contents…</p> : null}
        {tocError ? <p className="p-3 text-xs text-destructive">{tocError}</p> : null}

        <div className="py-1">
          {filtered.map((chapter) => {
            const chapterOpen = !!openChapters[chapter.chapter]
            return (
              <div key={chapter.chapter}>
                <button
                  onClick={() => setOpenChapters((prev) => ({ ...prev, [chapter.chapter]: !chapterOpen }))}
                  className="w-full text-left px-3 py-2 hover:bg-muted/40 text-sm font-medium flex items-center gap-2"
                >
                  {chapterOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                  <span>Chapter {chapter.chapter}{chapter.chapter_name ? ` - ${chapter.chapter_name}` : ""}</span>
                </button>

                {chapterOpen && (
                  <div>
                    {sortByPage(chapter.sections).map((section) => {
                      const sectionKey = `${chapter.chapter}:${section.section_number}`
                      const sectionOpen = !!openSections[sectionKey]
                      return (
                        <div key={sectionKey}>
                          <button
                            onClick={() => {
                              setOpenSections((prev) => ({ ...prev, [sectionKey]: !sectionOpen }))
                              void loadSection(section.section_number)
                            }}
                            className={`w-full text-left pl-8 pr-3 py-1.5 text-sm hover:bg-muted/40 flex items-center gap-2 ${selectedSectionId === section.section_number.replace(/\.$/, "") ? "bg-primary/10 text-primary" : ""}`}
                          >
                            {sectionOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                            <span className="font-medium">SECTION {section.section_number}</span>
                            {section.title ? <span className="text-muted-foreground"> - {section.title}</span> : null}
                          </button>

                          {sectionOpen && section.subsections.length > 0 && (
                            <div className="pb-1">
                              {sortByPage(section.subsections).map((sub) => (
                                <button
                                  key={`${sectionKey}:${sub.subsection_number}`}
                                  onClick={() => void loadSection(sub.subsection_number)}
                                  className={`block w-full text-left pl-14 pr-3 py-1.5 text-sm hover:bg-muted/30 ${selectedSectionId === sub.subsection_number.replace(/\.$/, "") ? "bg-primary/10 text-primary" : ""}`}
                                >
                                  <span>{sub.subsection_number}</span>
                                  {sub.title ? <span className="text-muted-foreground"> - {sub.title}</span> : null}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      <main className="overflow-y-auto p-5">
        {sectionLoading && <p className="text-sm text-muted-foreground">Loading section text…</p>}
        {sectionError && <p className="text-sm text-destructive">{sectionError}</p>}

        {!sectionLoading && !sectionError && !sectionContent && (
          <p className="text-sm text-muted-foreground">Select a chapter/section on the left to view extracted code text from the Tampa code PDFs.</p>
        )}

        {sectionContent && !sectionLoading && (
          <div className="space-y-4 max-w-4xl">
            <div>
              <h3 className="text-lg font-semibold">Sec. {sectionContent.section_number}</h3>
              <p className="text-sm text-muted-foreground">{sectionContent.title || "Section text"}</p>
              <p className="text-xs text-muted-foreground mt-1">Source PDF: {sectionContent.source_file} · starting near page {sectionContent.page || "N/A"}</p>
            </div>

            {sectionContent.chunks.map((chunk) => (
              <article key={chunk.chunk_id} className="rounded-md border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-3.5" />
                  <span>{chunk.section}</span>
                  <span>• page {chunk.page || "N/A"}</span>
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{chunk.text}</pre>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
