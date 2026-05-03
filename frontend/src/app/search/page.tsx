"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { SearchResponse, SearchProgress } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
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
  RotateCcw,
  RefreshCw,
  Square,
  Heart,
  MessageSquare,
  Eye,
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

// ─── localStorage helpers for persistent task tracking ───

const STORAGE_KEY = "medispa_active_task"

interface SavedTask {
  task_id: string
  keywords: string[]
  platforms: string[]
  region: string
  start_time: number
}

function saveTask(task: SavedTask) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(task))
  } catch { /* ignore quota errors */ }
}

function clearTask() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

function loadTask(): SavedTask | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ─── Helpers ───

function formatElapsed(ms: number): string {
  if (!ms) return "0s"
  const s = Math.floor(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

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
  const [progress, setProgress] = useState<SearchProgress | null>(null)
  const [expandError, setExpandError] = useState<string | null>(null)

  // ─── 신규 검색 옵션 ────────────────────────────
  const [maxDays, setMaxDays] = useState(30)               // 기간 (일)
  const [minLikes, setMinLikes] = useState(0)              // 전역 좋아요 오버라이드
  const [minComments, setMinComments] = useState(0)        // 전역 댓글 오버라이드
  const [minViews, setMinViews] = useState(0)              // 전역 조회수 오버라이드

  // Progress state
  const [taskId, setTaskId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState("0s")
  const [pausedTask, setPausedTask] = useState<SavedTask | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingRef = useRef(false)
  const [stopping, setStopping] = useState(false)

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // ─── On mount: check for previously saved active task ───
  useEffect(() => {
    const saved = loadTask()
    if (saved) {
      setPausedTask(saved)
    }
  }, [])

  // ─── Resume a saved task ───
  const resumeTask = useCallback(async () => {
    const saved = loadTask()
    if (!saved) return

    // Remove the paused banner immediately
    setPausedTask(null)

    // Restore UI state
    const t0 = saved.start_time
    setStartTime(t0)
    setElapsed(formatElapsed(Date.now() - t0))
    setSearching(true)
    setTaskId(saved.task_id)

    toast.info(`Resuming search: ${saved.keywords.length} keywords in ${saved.region}`)

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - t0))
    }, 1000)

    // Start polling
    await pollProgress(saved.task_id, t0)
  }, [])

  // ─── Dismiss a saved task without resuming ───
  function dismissSavedTask() {
    clearTask()
    setPausedTask(null)
    toast.info("Saved search dismissed")
  }

  // ─── Poll progress until completion ───
  async function pollProgress(taskId: string, t0: number) {
    if (pollingRef.current) return
    pollingRef.current = true

    let done = false
    while (!done) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const prog = await api.getSearchProgress(taskId)
        setProgress(prog)
        setElapsed(formatElapsed(Date.now() - t0))

        if (prog.status === "completed") {
          done = true
          clearTask()
          const timeStr = formatElapsed(Date.now() - t0)
          toast.success(`Search completed in ${timeStr}`)
          setStopping(false)
        } else if (prog.status === "failed") {
          done = true
          clearTask()
          toast.error("Search failed: " + (prog.error || "Unknown error"))
          setStopping(false)
        } else if (prog.status === "stopped") {
          done = true
          clearTask()
          toast.info("Search stopped — partial results saved")
          setStopping(false)
        }
      } catch {
        // progress endpoint might not be ready yet
      }
    }

    pollingRef.current = false
    setSearching(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  // ─── 🛑 Stop current search ───
  async function handleStop() {
    if (!taskId) return
    setStopping(true)
    try {
      await api.stopSearch(taskId)
      toast.info("Stop requested — collecting partial results...")
    } catch (err) {
      toast.error("Failed to stop: " + (err as Error).message)
      setStopping(false)
    }
  }

  // ─── Start a new search ───
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
    setProgress(null)
    setPausedTask(null)
    setStopping(false)
    const t0 = Date.now()
    setStartTime(t0)
    setElapsed("0s")

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - t0))
    }, 1000)

    try {
      const res = await api.search({
        keywords: useKeywords,
        platforms: selectedPlatforms,
        max_per_keyword: 20,
        region: selectedRegion,
        use_ai_scoring: true,
        // ─── 신규 파라미터 ──────────────
        max_days: maxDays,
        min_likes: minLikes > 0 ? minLikes : null,
        min_comments: minComments > 0 ? minComments : null,
        min_views: minViews > 0 ? minViews : null,
      })
      const newTaskId = res.task_id
      setTaskId(newTaskId)

      // 💾 Persist task info so it survives refresh
      saveTask({
        task_id: newTaskId,
        keywords: useKeywords,
        platforms: selectedPlatforms,
        region: selectedRegion,
        start_time: t0,
      })

      // Start polling
      await pollProgress(newTaskId, t0)
    } catch (err) {
      clearTask()
      toast.error("Search failed: " + (err as Error).message)
      setSearching(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
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

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
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

      {/* 🔔 Resume banner — shown when a saved task exists from before refresh */}
      {pausedTask && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                ⏳ Search in progress before refresh
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {pausedTask.keywords.length} keywords · {pausedTask.platforms.length} platforms · {pausedTask.region}
                {" · started "}{formatElapsed(Date.now() - pausedTask.start_time)} ago
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={dismissSavedTask}>
                Dismiss
              </Button>
              <Button size="sm" onClick={resumeTask}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

        {/* Platforms + Filters */}
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

            {/* ── 📅 검색 기간 ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Search Period
                </p>
                <span className="text-xs font-mono text-primary">
                  {maxDays === 365 ? "All time" : `Last ${maxDays} days`}
                </span>
              </div>
              <Slider
                value={[maxDays]}
                onValueChange={([v]) => setMaxDays(v)}
                min={1}
                max={365}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1d</span>
                <span>90d</span>
                <span>180d</span>
                <span>365d</span>
              </div>
            </div>

            <Separator />

            {/* ── 📊 Engagement 필터 ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                <Heart className="inline h-3 w-3 mr-1 text-red-400" />
                Engagement Thresholds (0 = platform default)
              </p>

              {/* Min likes */}
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Min Likes</span>
                    <span className="font-mono font-medium">{minLikes > 0 ? minLikes : "──"}</span>
                  </div>
                  <Slider
                    value={[minLikes]}
                    onValueChange={([v]) => setMinLikes(v)}
                    min={0}
                    max={500}
                    step={10}
                    className="w-full mt-1"
                  />
                </div>
              </div>

              {/* Min comments */}
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Min Comments</span>
                    <span className="font-mono font-medium">{minComments > 0 ? minComments : "──"}</span>
                  </div>
                  <Slider
                    value={[minComments]}
                    onValueChange={([v]) => setMinComments(v)}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full mt-1"
                  />
                </div>
              </div>

              {/* Min views */}
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Min Views</span>
                    <span className="font-mono font-medium">{minViews > 0 ? minViews : "──"}</span>
                  </div>
                  <Slider
                    value={[minViews]}
                    onValueChange={([v]) => setMinViews(v)}
                    min={0}
                    max={10000}
                    step={100}
                    className="w-full mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

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
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">{maxDays === 365 ? "All" : `${maxDays}d`}</span>
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

            {/* ── Execute / Stop 버튼 ── */}
            {searching ? (
              <Button
                className="w-full gap-2 text-base py-6"
                variant="destructive"
                onClick={handleStop}
                disabled={stopping}
              >
                {stopping ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
                {stopping
                  ? "Stopping..."
                  : `Stop Search ${elapsed}`}
              </Button>
            ) : (
              <Button
                className="w-full gap-2 text-base py-6"
                onClick={handleSearch}
              >
                <Search className="h-5 w-5" />
                Execute Search
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Banner (visible during search — survives refresh!) */}
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
                {progress && progress.current_keyword && (
                  <p className="text-xs text-primary font-mono mt-0.5">
                    🔍 {progress.current_platform}/{progress.current_keyword}
                    {" · "}{progress.results_so_far} found
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Elapsed: {elapsed}
                  {progress && progress.total_steps > 0 && (
                    <> · Step {progress.completed_steps}/{progress.total_steps}</>
                  )}
                </p>
              </div>
              <Badge variant="secondary">{elapsed}</Badge>
            </div>
            {/* Real progress bar */}
            {progress && progress.total_steps > 0 && (
              <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.completed_steps / progress.total_steps) * 100
                    )}%`,
                  }}
                />
              </div>
            )}
            {/* Task ID shown for debugging */}
            {taskId && (
              <p className="text-[10px] text-muted-foreground/50 mt-2 text-right">
                Task: {taskId}
              </p>
            )}
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
            {result.stopped && (
              <p className="text-xs text-amber-600 mt-2">
                🛑 Search was stopped. Partial results saved to library.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
