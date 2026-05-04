"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, Camera } from "lucide-react"
import { toast } from "sonner"

import { RegionSelect } from "@/components/ui/region-select"

interface Props {
  onSearchStart: (taskId: string) => void
}

export default function InstagramTab({ onSearchStart }: Props) {
  const [keyword, setKeyword] = useState("")
  const [searchType, setSearchType] = useState("hashtag")
  const [contentType, setContentType] = useState("posts")
  const [maxDays, setMaxDays] = useState(7)
  const [resultsLimit, setResultsLimit] = useState(20)
  const [region, setRegion] = useState("US")
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!keyword.trim()) { toast.error("Enter a hashtag or keyword"); return }
    setSearching(true)
    try {
      const res = await api.searchInstagram({
        keyword: keyword.trim(),
        search_type: searchType,
        content_type: contentType,
        max_days: maxDays,
        results_limit: resultsLimit,
        region: region,
      })
      onSearchStart(res.task_id)
      toast.success("Instagram search started!")
    } catch (e: any) {
      toast.error("Search failed: " + e.message)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-purple-600">
        <Camera className="h-5 w-5" />
        <span className="text-sm font-medium">Search Mode</span>
      </div>

      <div className="flex gap-2">
        {[
          { value: "hashtag", label: "Hashtag" },
          { value: "profile", label: "Profile" },
          { value: "place", label: "Place" },
          { value: "user", label: "User" },
        ].map(m => (
          <button
            key={m.value}
            onClick={() => setSearchType(m.value)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              searchType === m.value ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "hover:bg-accent/50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {[
          { value: "posts", label: "Posts" },
          { value: "reels", label: "Reels Only" },
          { value: "details", label: "Details" },
        ].map(m => (
          <button
            key={m.value}
            onClick={() => setContentType(m.value)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              contentType === m.value ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "hover:bg-accent/50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Input
        placeholder={searchType === "hashtag" ? "#skincare" : "Username or URL"}
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

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
      <div className="grid grid-cols-2 gap-4">
        <RegionSelect value={region} onChange={setRegion} />
        <div /> {/* spacer */}
      </div>

      <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 bg-purple-600 hover:bg-purple-700">
        {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {searching ? "Searching Instagram..." : "Search Instagram"}
      </Button>
    </div>
  )
}
