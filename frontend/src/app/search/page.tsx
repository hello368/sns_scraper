"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import type { SearchResponse, VideoItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  Search,
  Sparkles,
  Loader2,
  ChevronRight,
  Film,
  Music2,
  Camera,
  Globe,
} from "lucide-react"

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", icon: Music2, color: "text-pink-500" },
  { id: "instagram", label: "Instagram", icon: Camera, color: "text-purple-500" },
  { id: "facebook", label: "Facebook", icon: Globe, color: "text-blue-500" },
  { id: "youtube", label: "YouTube", icon: Film, color: "text-red-500" },
]

const DEFAULT_KEYWORDS = "medical spa facial\nbotox injection before after\ndermal filler treatment\nlaser skin resurfacing\nmicroneedling before after"

const CATEGORY_COLORS: Record<string, string> = {
  facial: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  botox: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  filler: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  laser: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

export default function SearchPage() {
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "tiktok",
    "instagram",
    "youtube",
  ])
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [newVideos, setNewVideos] = useState<VideoItem[]>([])

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  async function handleExpand() {
    setExpanding(true)
    try {
      const seeds = keywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean)
      if (seeds.length === 0) {
        toast.error("Enter at least one keyword")
        return
      }
      const res = await api.expandKeywords(seeds)
      setExpandedKeywords(res.keywords)
      toast.success(`${res.count} keywords expanded!`)
    } catch (err) {
      toast.error("Failed to expand keywords: " + (err as Error).message)
    } finally {
      setExpanding(false)
    }
  }

  async function handleSearch() {
    const rawKeywords = keywords
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean)
    const useKeywords = expandedKeywords.length > 0 ? expandedKeywords : rawKeywords

    if (useKeywords.length === 0) {
      toast.error("Enter at least one keyword")
      return
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform")
      return
    }

    setSearching(true)
    setResult(null)
    setNewVideos([])
    try {
      const res = await api.search({
        keywords: useKeywords,
        platforms: selectedPlatforms,
        max_per_keyword: 20,
        use_ai_scoring: true,
      })
      setResult(res)
      toast.success(`Found ${res.total_found} videos (${res.new_videos} new)`)
    } catch (err) {
      toast.error("Search failed: " + (err as Error).message)
    } finally {
      setSearching(false)
    }
  }

  // Helper to get platform icon
  function getPlatformIcon(platform: string) {
    const p = PLATFORMS.find((p) => p.id === platform)
    if (!p) return null
    const Icon = p.icon
    return <Icon className={`h-3.5 w-3.5 ${p.color}`} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">
          소셜미디어에서 의료 스파 트리트먼트 영상 검색
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Keywords Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Keywords</CardTitle>
            <CardDescription>한 줄에 하나씩 키워드 입력</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="Enter keywords, one per line..."
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleExpand}
              disabled={expanding}
            >
              {expanding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {expanding ? "Expanding..." : "AI Keyword Expansion"}
            </Button>
            {expandedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {expandedKeywords.slice(0, 20).map((kw) => (
                  <Badge key={kw} variant="secondary" className="text-xs">
                    {kw}
                  </Badge>
                ))}
                {expandedKeywords.length > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{expandedKeywords.length - 20} more
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platforms + Execute */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platforms</CardTitle>
            <CardDescription>검색할 플랫폼 선택</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map((platform) => {
                const Icon = platform.icon
                const checked = selectedPlatforms.includes(platform.id)
                return (
                  <label
                    key={platform.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePlatform(platform.id)}
                    />
                    <Icon className={`h-5 w-5 ${platform.color}`} />
                    <span className="text-sm font-medium">{platform.label}</span>
                  </label>
                )
              })}
            </div>

            <Separator />

            <Button
              className="w-full gap-2 text-base py-6"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              {searching ? "Searching..." : "Execute Search"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Results</CardTitle>
            <CardDescription>
              Found {result.total_found} videos across{" "}
              {result.platforms_used.length} platforms
              {result.after_dedup < result.total_found &&
                ` (${result.total_found - result.after_dedup} duplicates removed)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">{result.total_found}</p>
                <p className="text-xs text-muted-foreground">Total Found</p>
              </div>
              <div className="flex-1 rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">{result.after_dedup}</p>
                <p className="text-xs text-muted-foreground">After Dedup</p>
              </div>
              <div className="flex-1 rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">{result.new_videos}</p>
                <p className="text-xs text-muted-foreground">New Saved</p>
              </div>
              <div className="flex-1 rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {result.platforms_used.length}
                </p>
                <p className="text-xs text-muted-foreground">Platforms</p>
              </div>
            </div>
            {result.platforms_used.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {result.platforms_used.map((p) => (
                  <Badge key={p} variant="outline" className="gap-1">
                    {getPlatformIcon(p)}
                    {p}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
