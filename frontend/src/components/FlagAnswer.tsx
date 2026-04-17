import { useState } from "react"
import { Flag, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiUrl } from "@/lib/api"

type FlagState = "idle" | "open" | "submitting" | "confirmed" | "error"

type FlagAnswerProps = {
  queryType: "search" | "address_review"
  question?: string
  address?: string
  zoning?: string
  answerSnippet: string
}

export default function FlagAnswer({
  queryType,
  question = "",
  address = "",
  zoning = "",
  answerSnippet,
}: FlagAnswerProps) {
  const [state, setState] = useState<FlagState>("idle")
  const [comment, setComment] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const formOpen = state === "open" || state === "submitting" || state === "error"

  async function submit() {
    setState("submitting")
    setErrorMsg("")
    try {
      const res = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          query_type: queryType,
          question,
          address,
          zoning,
          answer_snippet: answerSnippet.slice(0, 500),
          comment,
        }),
      })
      if (!res.ok) {
        setState("error")
        setErrorMsg("Could not submit — please try again.")
        return
      }
      setState("confirmed")
    } catch {
      setState("error")
      setErrorMsg("Could not submit — please try again.")
    }
  }

  if (state === "confirmed") {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle className="size-4" />
        Received
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateRows: formOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms cubic-bezier(0.25, 1, 0.5, 1)",
          overflow: "hidden",
        }}
      >
        <div className="min-h-0 space-y-2 pb-2">
          <textarea
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            rows={3}
            placeholder="What was wrong with this answer? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={state === "submitting"}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} disabled={state === "submitting"}>
              {state === "submitting" ? "Submitting…" : "Submit feedback"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setState("idle")
                setComment("")
                setErrorMsg("")
              }}
              disabled={state === "submitting"}
            >
              Cancel
            </Button>
          </div>
          {state === "error" && errorMsg ? (
            <p className="text-xs text-destructive">{errorMsg}</p>
          ) : null}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        onClick={() => setState(formOpen ? "idle" : "open")}
      >
        <Flag className="size-3.5" />
        Flag as inaccurate
      </Button>
    </div>
  )
}
