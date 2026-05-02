"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import type { SearchResponse } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Search,
  Sparkles,
  Loader2,
  Film,
  Music2,
  Camera,
  Globe,
  Clock,
} from "lucide-react"

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", icon: Music2, color: "text-pink-500" },
  { id: "instagram", label: "Instagram", icon: Camera, color: "text-purple-500" },
  { id: "facebook", label: "Facebook", icon: Globe, color: "text-blue-500" },
  { id: "youtube", label: "YouTube", icon: Film, color: "text-red-500" },
]

const REGIONS = [
  { id: "US", label: "🇺🇸 USA" },
  { id: "JP", label: "🇯🇵 Japan" },
  { id: "KR", label: "🇰🇷 Korea" },
  { id: "EU", label: "🇪🇺 Europe" },
]

const DEFAULT_KEYWORDS =
  "medical spa facial\nbotox injection before after\ndermal filler treatment\nlaser skin resurfacing\nmicroneedling before after"

export default function SearchPage() {
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    "tiktok",
    "instagram",
    "youtube",
  ])
  const [selectedRegion, setSelectedRegion] = useState("US")
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([])
  const [searching, setSearching] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [expandError, setExpandError] = useState<string | null>(null)

  // Progress state
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState("0s")
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  function getKeywordCount(): number {
    return keywords
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean).length
  }

  function getTotalOperations(): number {
    const kwCount =
      expandedKeywords.length > 0
        ? expandedKeywords.length
        : getKeywordCount()
    const platforms = selectedPlatforms.length
    // Each keyword × platform = 1 API call, minus dedup
    return kwCount * platforms
  }

  async function handleExpand() {
    setExpanding(true)
    setExpandError(null)
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
      const msg = (err as Error).message
      setExpandError(msg)
      toast.error("Keyword expansion failed: " + msg)
    } finally {
      setExpanding(false)
    }
  }

  async function handleSearch() {
    const rawKeywords = keywords
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean)
    const useKeywords =
      expandedKeywords.length > 0 ? expandedKeywords : rawKeywords

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
    setStartTime(Date.now())
    setElapsed("0s")

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      if (startTime) {
        const s = Math.floor((Date.now() - startTime) / 1000)
        setElapsed(s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)
      }
    }, 1000)

    try {
      const res = await api.search({
        keywords: useKeywords,
        platforms: selectedPlatforms,
        max_per_keyword: 20,
        region: selectedRegion,
        use_ai_scoring: true,
      })
      setResult(res)
      const s = Math.floor((Date.now() - (startTime || Date.now())) / 1000)
      const timeStr = s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
      toast.success(
        `Done in ${timeStr}: ${res.total_found} found, ${res.new_videos} new`
      )
    } catch (err) {
      toast.error("Search failed: " + (err as Error).message)
    } finally {
      setSearching(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  function getPlatformIcon(platform: string) {
    const p = PLATFORMS.find((p) => p.id === platform)
    if (!p) return null
    const Icon = p.icon
    return <Icon className={`h-3.5 w-3.5 ${p.color}`} />
  }

  const useKeywords =
    expandedKeywords.length > 0
      ? expandedKeywords
      : keywords
          .split("\n")
          .map((k) => k.trim())
          .filter(Boolean)
  const totalOps = getTotalOperations()

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
              disabled={expanding || getKeywordCount() === 0}
            >
              {expanding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {expanding ? "Expanding with AI..." : "AI Keyword Expansion"}
            </Button>

            {expandError && (
              <p className="text-xs text-destructive">{expandError}</p>
            )}

            {expandedKeywords.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-2">
                  ✨ AI Expanded: {expandedKeywords.length} keywords
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {expandedKeywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
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
                    <span className="text-sm font-medium">
                      {platform.label}
                    </span>
                  </label>
                )
              })}
            </div>

            {/* Region Selector */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Target Region</p>
              <div className="flex gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRegion(r.id)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      selectedRegion === r.id
                        ? "border-primary bg-accent"
                        : "hover:bg-accent/50"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Plan Summary */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Keywords</span>
                <span className="font-medium">{useKeywords.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Platforms</span>
                <span className="font-medium">
                  {selectedPlatforms.length}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Region</span>
                <span className="font-medium">{REGIONS.find(r => r.id === selectedRegion)?.label || selectedRegion}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Expected calls</span>
                <span className="font-medium">
                  ~{totalOps} API calls
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Est. time</span>
                <span className="font-medium">
                  ~{Math.max(Math.round(totalOps * 3), 10)}s
                </span>
              </div>
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
              {searching
                ? `Searching... ${elapsed}`
                : "Execute Search"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress Banner (visible during search) */}
      {searching && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Searching {useKeywords.length} keywords ×{" "}
                  {selectedPlatforms.length} platforms in {REGIONS.find(r => r.id === selectedRegion)?.label || selectedRegion}
                </p>
                <p className="text-xs text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Elapsed: {elapsed} · Expected: ~
                  {Math.max(Math.round(totalOps * 3), 10)}s
                </p>
              </div>
              <Badge variant="secondary">{elapsed}</Badge>
            </div>
            {/* Simple progress bar animation */}
            <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" 
                   style={{ width: "60%" }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Results</CardTitle>
            <CardDescription>
              Found {result.total_found} videos across{" "}
              {result.platforms_used.length} platforms
              {result.after_dedup < result.total_found &&
                ` (${result.total_found - result.after_dedup} duplicates skipped)`}
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
                <p className="text-2xl font-bold text-green-600">
                  +{result.new_videos}
                </p>
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
