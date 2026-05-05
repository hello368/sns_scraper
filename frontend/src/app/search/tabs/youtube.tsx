"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Film } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

const SORT_OPTIONS = [
  { value: "views", label: "Most Viewed" },
  { value: "date", label: "Most Recent" },
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "Rating" },
]

const DATE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "year", label: "This Year" },
  { value: "month", label: "This Month" },
  { value: "week", label: "This Week" },
  { value: "today", label: "Today" },
]

const LENGTH_OPTIONS = [] as { value: string; label: string }[]

export default function YouTubeTab({ onSearchStart }: Props) {
  const [keyword, setKeyword] = useState("")
  const [sortBy, setSortBy] = useState("views")
  const [dateFilter, setDateFilter] = useState("year")
  const [maxResults, setMaxResults] = useState(20)
  const [region, setRegion] = useState("US")
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!keyword.trim()) { toast.error("Enter a search term"); return }
    setSearching(true)
    try {
      const res = await api.searchYouTube({
        keyword: keyword.trim(),
        sort_by: sortBy,
        date_filter: dateFilter,
        max_results: maxResults,
        region: region,
      })
      onSearchStart(res.task_id)
      toast.success("YouTube search started!")
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-red-500">
        <Film className="h-5 w-5" />
        <span className="text-sm font-medium">YouTube Search</span>
      </div>

      <Input
        placeholder="Search term (e.g. skin tightening)"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">Sort by</label>
        <div className="flex gap-2 flex-wrap">
          {SORT_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setSortBy(o.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                sortBy === o.value ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "hover:bg-accent/50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Max Results</label>
          <Input type="number" min={1} max={100} value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} />
        </div>
        <RegionSelect value={region} onChange={setRegion} />
      </div>

      <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 bg-red-600 hover:bg-red-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching YouTube..." : "Search YouTube"}
      </Button>
    </div>
  )
}
