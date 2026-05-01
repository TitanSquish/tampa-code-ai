import { ExternalLink, Search } from "lucide-react"
import { useMemo, useState } from "react"
import tocData from "@/data/tampaCodeToc.json"

export type TampaCodeTocNode = {
  id: string
  level: "chapter" | "article" | "division" | "section" | "other"
  label: string
  title: string
  page?: number | null
  children?: TampaCodeTocNode[]
}

const municodeUrl = "https://library.municode.com/fl/tampa/codes/code_of_ordinances"

function flatten(nodes: TampaCodeTocNode[]): TampaCodeTocNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children ?? [])])
}

export default function TampaCodeTocViewer() {
  const toc = tocData as TampaCodeTocNode[]
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(toc[0]?.id ?? null)

  const flat = useMemo(() => flatten(toc), [toc])
  const selected = flat.find((n) => n.id === selectedId) ?? null

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return toc
    const keep = (node: TampaCodeTocNode): TampaCodeTocNode | null => {
      const kids = (node.children ?? []).map(keep).filter(Boolean) as TampaCodeTocNode[]
      const hit = [node.label, node.title, node.level].some((v) => v.toLowerCase().includes(q))
      return hit || kids.length ? { ...node, children: kids } : null
    }
    return toc.map(keep).filter(Boolean) as TampaCodeTocNode[]
  }, [q, toc])

  const NodeRow = ({ node, depth }: { node: TampaCodeTocNode; depth: number }) => (
    <>
      <button
        onClick={() => setSelectedId(node.id)}
        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 ${selectedId === node.id ? "bg-primary/10 text-primary" : ""}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        <span className="font-medium">{node.label}</span>
        {node.title ? <span className="text-muted-foreground"> — {node.title}</span> : null}
      </button>
      {(node.children ?? []).map((child) => <NodeRow key={child.id} node={child} depth={depth + 1} />)}
    </>
  )

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-r border-border bg-card h-full overflow-y-auto md:sticky md:top-0">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold">Tampa Code References</h2>
          <p className="text-xs text-muted-foreground mt-1">Only chapters and sections included in PermitIQ&apos;s curated Tampa Code TOC are shown.</p>
          <a href={municodeUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Open official Tampa Municode <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="p-3 border-b border-border relative">
          <Search className="size-3.5 text-muted-foreground absolute left-5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapters, sections..." className="w-full h-8 pl-8 pr-2 text-xs rounded border bg-background" />
        </div>
        <div className="py-2">
          {filtered.map((n) => <NodeRow key={n.id} node={n} depth={0} />)}
        </div>
      </aside>
      <main className="overflow-y-auto p-5">
        {selected ? (
          <div className="space-y-3 max-w-3xl">
            <h3 className="text-lg font-semibold">{selected.label}</h3>
            <p className="text-sm text-muted-foreground">{selected.title}</p>
            <div className="text-xs text-muted-foreground">Level: <span className="font-medium text-foreground">{selected.level}</span></div>
            <div className="text-xs text-muted-foreground">TOC page: <span className="font-medium text-foreground">{selected.page ?? "N/A"}</span></div>
            {!!selected.children?.length && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Child sections</h4>
                <ul className="space-y-1 text-sm">
                  {selected.children.map((c) => <li key={c.id}><button onClick={() => setSelectedId(c.id)} className="text-left hover:underline">{c.label} — {c.title}</button></li>)}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground border-t pt-3">This is a curated table-of-contents reference. Verify the full legal text against the official Municode source.</p>
          </div>
        ) : <p className="text-sm text-muted-foreground">Select an item from the table of contents.</p>}
      </main>
    </div>
  )
}
