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
  Loader2, Search, Sparkles, SlidersHorizontal,
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

export default function AllInOneTab({ onSearchStart }: Props) {
  const [keywords, setKeywords] = useState("medical spa facial\nbotox injection\nlaser treatment")
  const [platforms, setPlatforms] = useState(["tiktok", "youtube"])
  const [region, setRegion] = useState("US")
  const [maxPerKeyword, setMaxPerKeyword] = useState(20)
  const [maxDays, setMaxDays] = useState(30)
  const [minViews, setMinViews] = useState("")
  const [minLikes, setMinLikes] = useState("")
  const [expanding, setExpanding] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(true)

  const PLATFORMS = [
    { id: "tiktok", label: "TikTok", color: "text-pink-500" },
    { id: "youtube", label: "YouTube", color: "text-red-500" },
  ]

  const togglePlatform = (id: string) => {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleSearch = async () => {
    const list = keywords.split("\n").map(k => k.trim()).filter(Boolean)
    if (list.length === 0 || platforms.length === 0) return
    setSearching(true)
    try {
      const res = await api.search({
        keywords: list,
        platforms,
        max_per_keyword: maxPerKeyword,
        region,
        use_ai_scoring: true,
        max_days: maxDays > 0 ? maxDays : undefined,
        min_views: minViews ? parseInt(minViews) : undefined,
        min_likes: minLikes ? parseInt(minLikes) : undefined,
      })
      onSearchStart(res.task_id, list)
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  const handleExpand = async () => {
    const seeds = keywords.split("\n").map(k => k.trim()).filter(Boolean)
    if (seeds.length === 0) return
    setExpanding(true)
    try {
      const res = await api.expandKeywords(seeds)
      toast.success(`${res.count} keywords expanded!`)
    } catch (e: any) {
      toast.error("Expansion failed: " + e.message)
    } finally {
      setExpanding(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Keywords */}
      <div>
        <label className="text-sm font-medium">Keywords (one per line)</label>
        <textarea
          className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
        />
      </div>

      {/* Platforms */}
      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => togglePlatform(p.id)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              platforms.includes(p.id) ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Basic controls */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">
            <Hash className="h-3 w-3 inline mr-1" />
            Max per keyword
          </label>
          <Input
            type="number"
            min={1}
            max={100}
            value={maxPerKeyword}
            onChange={e => setMaxPerKeyword(Math.max(1, Math.min(100, Number(e.target.value) || 20)))}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">
            <Calendar className="h-3 w-3 inline mr-1" />
            Time range
          </label>
          <Select value={String(maxDays)} onValueChange={v => setMaxDays(Number(v))}>
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
              type="number"
              min={0}
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
              type="number"
              min={0}
              placeholder="e.g. 100"
              value={minLikes}
              onChange={e => setMinLikes(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleExpand} disabled={expanding} className="gap-2">
          {expanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI Expand
        </Button>
        <Button onClick={handleSearch} disabled={searching} className="gap-2 flex-1">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search All Platforms
        </Button>
      </div>
    </div>
  )
}
