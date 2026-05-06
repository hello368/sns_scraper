"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2, Search, Music2, SlidersHorizontal,
  Eye, ThumbsUp, Hash, Calendar, MapPin,
} from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string, keywords?: string[]) => void
}

const DATE_PRESETS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 3 months" },
  { value: 365, label: "Last year" },
  { value: 0, label: "All time" },
]

export default function TikTokTab({ onSearchStart }: Props) {
  const [keyword, setKeyword] = useState("")
  const [maxResults, setMaxResults] = useState(20)
  const [region, setRegion] = useState("US")
  const [datePreset, setDatePreset] = useState(7)
  const [minViews, setMinViews] = useState("")
  const [minLikes, setMinLikes] = useState("")
  const [searching, setSearching] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(true)

  const handleSearch = async () => {
    if (!keyword.trim()) { toast.error("Enter a keyword"); return }
    setSearching(true)
    try {
      const res = await api.searchTikTok({
        keyword: keyword.trim(),
        max_results: maxResults,
        region: region,
        date_filter: String(datePreset),
        min_views: minViews ? parseInt(minViews) : undefined,
        min_likes: minLikes ? parseInt(minLikes) : undefined,
      })
      onSearchStart(res.task_id, [keyword.trim()])
      toast.success("TikTok search started!")
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-pink-500">
        <Music2 className="h-5 w-5" />
        <span className="text-sm font-medium">TikTok Keyword Search</span>
      </div>

      <Input
        placeholder="Keyword (e.g. skincare)"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

      {/* Basic controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[130px]">
          <label className="text-xs text-muted-foreground mb-1 block">
            <Hash className="h-3 w-3 inline mr-1" />
            Max Results
          </label>
          <Input type="number" min={1} max={50} value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">
            <Calendar className="h-3 w-3 inline mr-1" />
            Time range
          </label>
          <Select value={String(datePreset)} onValueChange={v => setDatePreset(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(p => (
                <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[130px]">
          <label className="text-xs text-muted-foreground mb-1 block">
            <MapPin className="h-3 w-3 inline mr-1" />
            Region
          </label>
          <RegionSelect value={region} onChange={setRegion} />
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {showAdvanced ? "Hide" : "Show"} advanced filters
      </button>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-[130px]">
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Min views
            </label>
            <Input
              type="number" min={0}
              placeholder="e.g. 1000"
              value={minViews}
              onChange={e => setMinViews(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              Min likes
            </label>
            <Input
              type="number" min={0}
              placeholder="e.g. 100"
              value={minLikes}
              onChange={e => setMinLikes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* TikTok info box */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
        <p className="text-xs text-amber-700 dark:text-amber-300">
💡 TikTok likes are capped at 10,000. Auto-filtering uses playCount (views) instead. The paid leastDiggs filter can filter by likes (replaces date filter).
        </p>
      </div>

      <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 bg-pink-600 hover:bg-pink-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching TikTok..." : "Search TikTok"}
      </Button>
    </div>
  )
}
