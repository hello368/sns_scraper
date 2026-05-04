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
  { value: "hour", label: "Past Hour" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
]

const LENGTH_OPTIONS = [
  { value: "", label: "Any" },
  { value: "under4", label: "Under 4 min" },
  { value: "between420", label: "4-20 min" },
  { value: "plus20", label: "Over 20 min" },
]

export default function YouTubeTab({ onSearchStart }: Props) {
  const [keyword, setKeyword] = useState("")
  const [sortBy, setSortBy] = useState("views")
  const [dateFilter, setDateFilter] = useState("week")
  const [lengthFilter, setLengthFilter] = useState("under4")
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
        length_filter: lengthFilter,
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
          <label className="text-xs text-muted-foreground mb-2 block">Upload date</label>
          <div className="flex gap-2 flex-wrap">
            {DATE_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setDateFilter(o.value)}
                className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  dateFilter === o.value ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "hover:bg-accent/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Duration</label>
          <div className="flex gap-2 flex-wrap">
            {LENGTH_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => setLengthFilter(o.value)}
                className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  lengthFilter === o.value ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "hover:bg-accent/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
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
