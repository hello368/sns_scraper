"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

export default function AllInOneTab({ onSearchStart }: Props) {
  const [keywords, setKeywords] = useState("medical spa facial\nbotox injection\nlaser treatment")
  const [platforms, setPlatforms] = useState(["tiktok", "instagram", "youtube"])
  const [region, setRegion] = useState("US")
  const [expanding, setExpanding] = useState(false)
  const [searching, setSearching] = useState(false)

  const PLATFORMS = [
    { id: "tiktok", label: "TikTok", color: "text-pink-500" },
    { id: "instagram", label: "Instagram", color: "text-purple-500" },
    { id: "youtube", label: "YouTube", color: "text-red-500" },
    { id: "facebook", label: "Facebook", color: "text-blue-500" },
  ]

  const togglePlatform = (id: string) => {
    setPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleSearch = async () => {
    const list = keywords.split("\n").map(k => k.trim()).filter(Boolean)
    if (list.length === 0 || platforms.length === 0) return
    setSearching(true)
    try {
      const res = await api.search({ keywords: list, platforms, max_per_keyword: 10, region: region, use_ai_scoring: true })
      onSearchStart(res.task_id)
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
      <div>
        <label className="text-sm font-medium">Keywords (one per line)</label>
        <textarea
          className="mt-1 flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
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

      <RegionSelect value={region} onChange={setRegion} />

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
