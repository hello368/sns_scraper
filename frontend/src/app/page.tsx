"use client"

import { useEffect, useState, useCallback } from "react"
import { api } from "@/lib/api"
import type { VideoItem, LibraryStats, StatusResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Film,
  Globe,
  Download,
  Clock,
  Syringe,
  CheckCircle2,
  XCircle,
  HardDrive,
  ExternalLink,
  ArrowUpDown,
  Coins,
} from "lucide-react"

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  instagram: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  facebook: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  youtube: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const CATEGORY_COLORS: Record<string, string> = {
  facial: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  botox: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  filler: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  laser: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  other: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const REGION_NAMES: Record<string, string> = {
  US: "🇺🇸 USA",
  JP: "🇯🇵 Japan",
  KR: "🇰🇷 Korea",
  EU: "🇪🇺 Europe",
}

const REGION_COLORS: Record<string, string> = {
  US: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  JP: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  KR: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  EU: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at", label: "📅 Date" },
  { value: "likes", label: "❤️ Likes" },
  { value: "comments", label: "💬 Comments" },
  { value: "views", label: "👁 Views" },
  { value: "relevance_score", label: "⭐ Score" },
]

function StatCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  description?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

function PlatformBar({
  platform,
  count,
  total,
}: {
  platform: string
  count: number
  total: number
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="capitalize font-medium">{platform}</span>
        <span className="text-muted-foreground">{count}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            platform === "tiktok"
              ? "bg-pink-500"
              : platform === "instagram"
                ? "bg-purple-500"
                : platform === "facebook"
                  ? "bg-blue-500"
                  : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return String(n)
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filter/sort state
  const [regionFilter, setRegionFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("created_at")
  const [sortOrder, setSortOrder] = useState<string>("desc")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const regionParam = regionFilter !== "all" ? regionFilter : undefined
      const [s, st, vRes] = await Promise.all([
        api.getStatus(),
        api.getStats(regionParam),
        api.getVideos({
          limit: 200,
          region: regionParam,
          sort_by: sortBy as any,
          sort_order: sortOrder as any,
        }),
      ])
      setStatus(s)
      setStats(st)
      setVideos(vRes.videos)
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }, [regionFilter, sortBy, sortOrder])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Loading overview...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const totalByPlatform = stats?.by_platform ?? {}
  const platformTotal = Object.values(totalByPlatform).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">MediSpa AI Content Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Film}
          label="Total Videos"
          value={status?.total_videos ?? 0}
          description="Videos stored in database"
        />
        <StatCard
          icon={Globe}
          label="Platforms"
          value={Object.keys(totalByPlatform).length}
          description="Active collection platforms"
        />
        <StatCard
          icon={Download}
          label="Downloaded"
          value={stats?.downloaded ?? 0}
          description="Stored on disk"
        />
        <StatCard
          icon={Coins}
          label="Total Searches"
          value={stats?.total_searches ?? 0}
          description={`CU: ${stats?.total_cu_cost ?? "—"}`}
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Region Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Region:</span>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setRegionFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                regionFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {Object.entries(REGION_NAMES).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRegionFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  regionFilter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="px-2 py-1.5 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
          >
            {sortOrder === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Distribution</CardTitle>
            <CardDescription>Videos by Platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(totalByPlatform).length > 0 ? (
              Object.entries(totalByPlatform).map(([platform, count]) => (
                <PlatformBar
                  key={platform}
                  platform={platform}
                  count={count}
                  total={platformTotal}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No videos collected yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
            <CardDescription>Service & Resource Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Apify</span>
              </div>
              <Badge
                variant={status?.apify_configured ? "default" : "destructive"}
                className="gap-1"
              >
                {status?.apify_configured ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {status?.apify_configured ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">DeepSeek AI</span>
              </div>
              <Badge
                variant={status?.deepseek_configured ? "default" : "destructive"}
                className="gap-1"
              >
                {status?.deepseek_configured ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {status?.deepseek_configured ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Disk Usage</span>
              </div>
              <Badge
                variant={
                  (status?.disk_usage_pct ?? 0) > 80
                    ? "destructive"
                    : (status?.disk_usage_pct ?? 0) > 60
                      ? "secondary"
                      : "default"
                }
              >
                {status?.disk_usage_pct.toFixed(1)}%
              </Badge>
            </div>
            {/* New: Credit usage */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Credit Usage</span>
              </div>
              <div className="text-right">
                <Badge variant="default" className="gap-1">
                  {stats?.total_cu_cost?.toFixed(4) ?? "—"} CU
                </Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {stats?.total_searches ?? 0} searches
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Videos Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Library Videos</CardTitle>
          <CardDescription>
            {stats?.total_videos ?? 0} videos · Sorted by{" "}
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? sortBy}{" "}
            {sortOrder === "desc" ? "↓" : "↑"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Title</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>❤️</TableHead>
                    <TableHead>💬</TableHead>
                    <TableHead>👁</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[300px]">
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 font-medium hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {v.title || v.url?.split("/").pop() || "Untitled"}
                          </span>
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={PLATFORM_COLORS[v.platform] ?? ""}
                          variant="outline"
                        >
                          {v.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={REGION_COLORS[v.region] ?? ""}
                          variant="outline"
                        >
                          {REGION_NAMES[v.region] || v.region}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(v.likes ?? 0) > 0 ? formatCount(v.likes) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(v.comments ?? 0) > 0 ? formatCount(v.comments) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(v.views ?? 0) > 0 ? formatCount(v.views) : "—"}
                      </TableCell>
                      <TableCell>
                        {v.relevance_score != null ? (
                          <span className="font-mono text-sm">
                            {v.relevance_score >= 7
                              ? "🟢"
                              : v.relevance_score >= 4
                                ? "🟡"
                                : "🔴"}{" "}
                            {v.relevance_score}/10
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Film className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No videos yet. Go to Search to start collecting!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
