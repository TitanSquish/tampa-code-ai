import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 bg-card border-b border-border flex items-center px-6">
        <span className="text-[15px] font-semibold text-foreground flex-1">
          Tampa Code AI
        </span>
        <Button variant="ghost" size="sm">
          Sign out
        </Button>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-8">
        <Tabs defaultValue="code-search">
          <TabsList className="w-full">
            <TabsTrigger value="code-search" className="flex-1">
              Code Search
            </TabsTrigger>
            <TabsTrigger value="address-review" className="flex-1">
              Address Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code-search" className="mt-6 space-y-3">
            <h2 className="text-[20px] font-semibold leading-[1.25] text-foreground">
              Code Search
            </h2>
            <p className="text-[15px] font-normal leading-[1.5] text-muted-foreground max-w-[72ch]">
              Ask a question about Tampa building codes and permit requirements.
            </p>
            <Badge variant="secondary">Coming in Phase 3</Badge>
          </TabsContent>

          <TabsContent value="address-review" className="mt-6 space-y-3">
            <h2 className="text-[20px] font-semibold leading-[1.25] text-foreground">
              Address Review
            </h2>
            <p className="text-[15px] font-normal leading-[1.5] text-muted-foreground max-w-[72ch]">
              Enter a Tampa property address to get permit requirements for your project.
            </p>
            <Badge variant="secondary">Coming in Phase 3</Badge>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
