"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Globe } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

export default function FacebookTab({ onSearchStart }: Props) {
  const [mode, setMode] = useState<"keyword" | "url">("keyword")
  const [keyword, setKeyword] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [maxDays, setMaxDays] = useState(7)
  const [resultsLimit, setResultsLimit] = useState(20)
  const [region, setRegion] = useState("US")
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (mode === "keyword" && !keyword.trim()) { toast.error("Enter a keyword"); return }
    if (mode === "url" && !pageUrl.trim()) { toast.error("Enter a page URL"); return }
    setSearching(true)
    try {
      const res = await api.searchFacebook({
        keyword: mode === "keyword" ? keyword.trim() : undefined,
        page_url: mode === "url" ? pageUrl.trim() : undefined,
        max_days: maxDays,
        results_limit: resultsLimit,
        region: region,
      })
      onSearchStart(res.task_id)
      toast.success("Facebook search started!")
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-blue-500">
        <Globe className="h-5 w-5" />
        <span className="text-sm font-medium">Facebook Posts Search</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("keyword")}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            mode === "keyword" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "hover:bg-accent/50"
          }`}
        >
          Keyword Search
        </button>
        <button
          onClick={() => setMode("url")}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            mode === "url" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" : "hover:bg-accent/50"
          }`}
        >
          Page URL
        </button>
      </div>

      {mode === "keyword" ? (
        <Input
          placeholder="Search keyword (e.g. skin care)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
        />
      ) : (
        <Input
          placeholder="https://www.facebook.com/PageName"
          value={pageUrl}
          onChange={e => setPageUrl(e.target.value)}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Period</label>
          <select
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={maxDays}
            onChange={e => setMaxDays(Number(e.target.value))}
          >
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max Results</label>
          <Input type="number" min={1} max={100} value={resultsLimit} onChange={e => setResultsLimit(Number(e.target.value))} />
        </div>
      </div>

      <RegionSelect value={region} onChange={setRegion} />

      <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching Facebook..." : "Search Facebook"}
      </Button>
    </div>
  )
}
