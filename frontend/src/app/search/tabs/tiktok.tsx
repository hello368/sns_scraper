"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Music2 } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

export default function TikTokTab({ onSearchStart }: Props) {
  const [keyword, setKeyword] = useState("")
  const [maxResults, setMaxResults] = useState(20)
  const [region, setRegion] = useState("US")
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!keyword.trim()) { toast.error("Enter a keyword"); return }
    setSearching(true)
    try {
      const res = await api.searchTikTok({
        keyword: keyword.trim(),
        max_results: maxResults,
        region: region,
      })
      onSearchStart(res.task_id)
      toast.success("TikTok search started!")
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-pink-500">
        <Music2 className="h-5 w-5" />
        <span className="text-sm font-medium">TikTok Keyword Search</span>
      </div>

      <Input
        placeholder="Keyword (e.g. skincare)"
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Max Results</label>
          <Input type="number" min={1} max={50} value={maxResults} onChange={e => setMaxResults(Number(e.target.value))} />
        </div>
        <RegionSelect value={region} onChange={setRegion} />
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
        <p className="text-xs text-amber-700 dark:text-amber-300">
💡 TikTok likes are capped at 10,000. Auto-filtering uses playCount (views) instead. The paid leastDiggs filter can filter by likes (replaces date filter).
        </p>
      </div>

      <RegionSelect value={region} onChange={setRegion} />

      <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 bg-pink-600 hover:bg-pink-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching TikTok..." : "Search TikTok"}
      </Button>
    </div>
  )
}
