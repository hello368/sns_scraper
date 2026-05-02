"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import type { VideoItem, LibraryStats } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Download,
  Film,
  Music2,
  Camera,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react"
import { toast } from "sonner"

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  tiktok: Music2,
  instagram: Camera,
  facebook: Globe,
  youtube: Film,
}

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "text-pink-500 bg-pink-100 dark:bg-pink-900/30",
  instagram: "text-purple-500 bg-purple-100 dark:bg-purple-900/30",
  facebook: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
  youtube: "text-red-500 bg-red-100 dark:bg-red-900/30",
}

const CATEGORY_COLORS: Record<string, string> = {
  facial: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  botox: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  filler: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  laser: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

export default function LibraryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [platformFilter, setPlatformFilter] = useState<string>("all")
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [downloadingAll, setDownloadingAll] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [v, s] = await Promise.all([
        api.getVideos({ limit: 200 }),
        api.getStats(),
      ])
      setVideos(v)
      setStats(s)
    } catch (err) {
      toast.error("Failed to load library")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter logic
  const filtered = videos.filter((v) => {
    if (categoryFilter !== "all" && v.category !== categoryFilter) return false
    if (platformFilter !== "all" && v.platform !== platformFilter) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const matchTitle = v.title?.toLowerCase().includes(q)
      const matchDesc = v.description?.toLowerCase().includes(q)
      const matchUrl = v.url?.toLowerCase().includes(q)
      if (!matchTitle && !matchDesc && !matchUrl) return false
    }
    return true
  })

  async function handleDownload(videoId: string) {
    setDownloading((prev) => new Set(prev).add(videoId))
    try {
      const res = await api.download([videoId])
      toast.success(`Download queued: ${res.queued_count} video(s)`)
    } catch (err) {
      toast.error("Download failed: " + (err as Error).message)
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev)
        next.delete(videoId)
        return next
      })
    }
  }

  async function handleDownloadSelected() {
    if (selectedIds.size === 0) {
      toast.error("Select videos to download")
      return
    }
    setDownloadingAll(true)
    try {
      const res = await api.download(Array.from(selectedIds))
      toast.success(`Download queued: ${res.queued_count} video(s)`)
      setSelectedIds(new Set())
    } catch (err) {
      toast.error("Download failed: " + (err as Error).message)
    } finally {
      setDownloadingAll(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return "—"
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">Loading videos...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">수집된 영상 라이브러리</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Film className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No videos in library
            </p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              Go to Search tab to start collecting content
            </p>
            <Button variant="outline" onClick={() => window.location.href = "/search"}>
              Go to Search
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-muted-foreground">
            {videos.length} videos · {stats?.downloaded_count ?? 0} downloaded
          </p>
        </div>
        {selectedIds.size > 0 && (
          <Button
            onClick={handleDownloadSelected}
            disabled={downloadingAll}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloadingAll ? "Queuing..." : `Download (${selectedIds.size})`}
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(value: string | null) => setCategoryFilter(value ?? "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="facial">Facial</SelectItem>
            <SelectItem value="botox">Botox</SelectItem>
            <SelectItem value="filler">Filler</SelectItem>
            <SelectItem value="laser">Laser</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={platformFilter}
          onValueChange={(value: string | null) => setPlatformFilter(value ?? "all")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Video Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((video) => {
            const PlatformIcon = PLATFORM_ICONS[video.platform]
            const isSelected = selectedIds.has(video.id)
            const isDownloading = downloading.has(video.id)

            return (
              <Card
                key={video.id}
                className={`group cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => toggleSelect(video.id)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted overflow-hidden rounded-t-xl">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title || "Video thumbnail"}
                      className="object-cover w-full h-full"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Film className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Platform badge on thumbnail */}
                  <div className="absolute top-2 left-2">
                    <Badge
                      variant="secondary"
                      className={`gap-1 text-xs ${
                        PLATFORM_COLORS[video.platform]
                      }`}
                    >
                      {PlatformIcon && <PlatformIcon className="h-3 w-3" />}
                      {video.platform}
                    </Badge>
                  </div>
                  {/* Duration */}
                  {video.duration > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute bottom-2 right-2 text-xs"
                    >
                      {formatDuration(video.duration)}
                    </Badge>
                  )}
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10 text-primary" />
                    </div>
                  )}
                </div>

                <CardContent className="p-3 space-y-2">
                  {/* Title */}
                  <p className="text-sm font-medium leading-tight line-clamp-2">
                    {video.title || "Untitled"}
                  </p>
                  {/* Author */}
                  <p className="text-xs text-muted-foreground truncate">
                    {video.author || "Unknown"}
                  </p>
                  {/* Tags */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {video.category && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          CATEGORY_COLORS[video.category] ?? ""
                        }`}
                      >
                        {video.category}
                      </Badge>
                    )}
                    {video.relevance_score != null && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {video.relevance_score}/10
                      </Badge>
                    )}
                  </div>
                  {/* Action row */}
                  <div className="flex items-center justify-between pt-1">
                    {video.downloaded ? (
                      <Badge
                        variant="default"
                        className="bg-green-600 text-xs gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Downloaded
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownload(video.id)
                        }}
                        disabled={isDownloading}
                      >
                        <Download className="h-3 w-3" />
                        {isDownloading ? "..." : "Download"}
                      </Button>
                    )}
                    {video.file_size > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {(video.file_size / 1024 / 1024).toFixed(1)}MB
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No videos match the current filters</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
