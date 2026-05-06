"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import type { SearchProgress } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Search, Loader2, Square, RefreshCw, RotateCcw,
  Music2, Film, BarChart3,
} from "lucide-react"

import AllInOneTab from "./tabs/all-in-one"
import YouTubeTab from "./tabs/youtube"
import TikTokTab from "./tabs/tiktok"

type TabId = "all" | "youtube" | "tiktok"

const TABS: { id: TabId; label: string; icon: any; color: string }[] = [
  { id: "all", label: "All-in-One", icon: Search, color: "text-foreground" },
  { id: "youtube", label: "YouTube", icon: Film, color: "text-red-500" },
  { id: "tiktok", label: "TikTok", icon: Music2, color: "text-pink-500" },
]

const STORAGE_KEY = "medispa_active_task"

interface SavedTask {
  task_id: string; keywords: string[]; platforms: string[]
  start_time: number
}

interface LiveResult {
  id: string; url: string; platform: string; title: string
  thumbnail_url: string; username: string
  likes: number; comments: number; views: number
  relevance_score: number; created_at: string
}

function saveTask(t: SavedTask) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)) } catch {}
}
function clearTask() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
function loadTask(): SavedTask | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

function formatElapsed(ms: number): string {
  if (!ms) return "0s"
  const s = Math.floor(ms / 1000)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<TabId>("all")
  const [searching, setSearching] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState("0s")
  const [progress, setProgress] = useState<SearchProgress | null>(null)
  const [pausedTask, setPausedTask] = useState<SavedTask | null>(null)
  const [stopping, setStopping] = useState(false)
  const [liveResults, setLiveResults] = useState<LiveResult[]>([])
  const [resultCount, setResultCount] = useState(0)
  const [searchKeywords, setSearchKeywords] = useState<string[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingRef = useRef(false)

  useEffect(() => {
    const saved = loadTask()
    if (saved) setPausedTask(saved)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const pollProgress = useCallback(async (tid: string, t0: number) => {
    if (pollingRef.current) return
    pollingRef.current = true
    let done = false
    while (!done) {
      await new Promise(r => setTimeout(r, 1500))
      try {
        const prog = await api.getSearchProgress(tid)
        setProgress(prog)
        setElapsed(formatElapsed(Date.now() - t0))
        if (prog.status === "completed") {
          done = true; clearTask()
          // 검색 완료 후 키워드로 필터링된 결과 가져오기
          toast.success(`Search completed in ${formatElapsed(Date.now() - t0)}`)
          if (searchKeywords.length > 0) {
            try {
              const lib = await api.getVideos({ search: searchKeywords[0], limit: 20, sort_by: "relevance_score", sort_order: "desc" })
              if (lib?.videos?.length) { setLiveResults(lib.videos); setResultCount(lib.total) }
            } catch {}
          }
          setStopping(false)
        } else if (prog.status === "failed") {
          done = true; clearTask()
          toast.error("Search failed: " + (prog.error || "Unknown"))
          setStopping(false)
        } else if (prog.status === "stopped") {
          done = true; clearTask()
          toast.info("Search stopped — partial results saved")
          // 중단되어도 저장된 결과는 표시
          if (searchKeywords.length > 0) {
            try {
              const lib = await api.getVideos({ search: searchKeywords[0], limit: 10, sort_by: "relevance_score", sort_order: "desc" })
              if (lib?.videos?.length) { setLiveResults(lib.videos); setResultCount(lib.total) }
            } catch {}
          }
          setStopping(false)
        }
      } catch (e) {
        // 서버 다운 감지 (404 또는 connection refused)
        const elapsed = Date.now() - t0
        if (elapsed > 60000) { // 1분 이상 검색 중 서버 끊김
          done = true; clearTask()
          toast.error(`Connection lost during search (${formatElapsed(elapsed)}). Results may be partial.`)
          setSearching(false)
          // 이미 저장된 결과라도 표시
          if (searchKeywords.length > 0) {
            try {
              const lib = await api.getVideos({ search: searchKeywords[0], limit: 10, sort_by: "created_at", sort_order: "desc" })
              if (lib?.videos?.length) { setLiveResults(lib.videos); setResultCount(lib.total) }
            } catch {}
          }
          break
        }
      }
    }
    pollingRef.current = false
    setSearching(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [searchKeywords])

  const handleSearchStart = useCallback((newTaskId: string, keywords?: string[]) => {
    setSearching(true)
    setProgress(null)
    setPausedTask(null)
    setStopping(false)
    setLiveResults([])
    setResultCount(0)
    setTaskId(newTaskId)
    setSearchKeywords(keywords || [])
    const t0 = Date.now()
    setStartTime(t0)
    setElapsed("0s")
    timerRef.current = setInterval(() => setElapsed(formatElapsed(Date.now() - t0)), 1000)
    saveTask({ task_id: newTaskId, keywords: keywords || [], platforms: [], start_time: t0 })
    pollProgress(newTaskId, t0)
  }, [pollProgress])

  const handleStop = async () => {
    if (!taskId) return
    setStopping(true)
    try { await api.stopSearch(taskId); toast.info("Stopping...") }
    catch { setStopping(false) }
  }

  const resumeTask = useCallback(async () => {
    const saved = loadTask()
    if (!saved) return
    setPausedTask(null)
    const t0 = saved.start_time
    setStartTime(t0)
    setElapsed(formatElapsed(Date.now() - t0))
    setSearching(true)
    setTaskId(saved.task_id)
    setSearchKeywords(saved.keywords || [])
    timerRef.current = setInterval(() => setElapsed(formatElapsed(Date.now() - t0)), 1000)
    await pollProgress(saved.task_id, t0)
  }, [pollProgress])

  const renderTab = () => {
    switch (activeTab) {
      case "all": return <AllInOneTab onSearchStart={handleSearchStart} />
      case "youtube": return <YouTubeTab onSearchStart={handleSearchStart} />
      case "tiktok": return <TikTokTab onSearchStart={handleSearchStart} />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-muted-foreground">Search content optimized by platform</p>
      </div>

      {/* Resume banner */}
      {pausedTask && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⏳ Search in progress before refresh</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { clearTask(); setPausedTask(null) }}>Dismiss</Button>
            <Button size="sm" onClick={resumeTask}><RotateCcw className="h-3.5 w-3.5 mr-1" />Resume</Button>
          </CardContent>
        </Card>
      )}

      {/* Progress bar when searching */}
      {searching && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {stopping ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="text-sm font-medium">{stopping ? "Stopping..." : "Searching..."}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{elapsed}</span>
                {!stopping && (
                  <Button size="sm" variant="destructive" onClick={handleStop} className="h-7 gap-1">
                    <Square className="h-3 w-3" /> Stop
                  </Button>
                )}
              </div>
            </div>
            {progress && (
              <div className="space-y-1">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((progress.completed_steps || 0) / (progress.total_steps || 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.current_platform ? `${progress.current_platform}: ${progress.current_keyword || ""}` : ""}</span>
                  <span>{progress.results_so_far || 0} found</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 border-b pb-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${tab.color}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <Card>
        <CardContent className="pt-6">
          {renderTab()}
        </CardContent>
      </Card>

      {/* Live results — keyword-filtered after search completes */}
      {(liveResults.length > 0 || (progress?.status === "completed" && resultCount > 0)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Results {searchKeywords.length > 0 && <span className="text-sm font-normal text-muted-foreground">for "{searchKeywords[0]}"</span>}
              {searching && <span className="text-sm font-normal text-muted-foreground"> (updating...)</span>}
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.location.href = `/library?search=${encodeURIComponent(searchKeywords[0] || "")}`}>
                View in Library →
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {liveResults.slice(0, 10).map(v => (
              <a
                key={v.id}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="aspect-[16/9] bg-muted relative overflow-hidden">
                  {v.thumbnail_url && (
                    <img
                      src={v.thumbnail_url}
                      alt={v.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  )}
                  <Badge className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 opacity-90">
                    {v.platform}
                  </Badge>
                </div>
                <div className="p-2.5 space-y-1">
                  <p className="text-sm font-medium leading-tight line-clamp-2">{v.title}</p>
                  <p className="text-xs text-muted-foreground">{v.username}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>❤️ {(v.likes || 0).toLocaleString()}</span>
                    <span>👁 {(v.views || 0).toLocaleString()}</span>
                    <span>💬 {(v.comments || 0).toLocaleString()}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Results summary */}
      {progress && progress.status === "completed" && (
        <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              ✅ Complete — {progress.results_so_far || 0} videos saved to library
            </p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => window.location.href = `/library?search=${encodeURIComponent(searchKeywords[0] || "")}`}>
                View Results in Library
              </Button>
              <Button size="sm" variant="outline" onClick={() => setProgress(null)}>
                Search Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
