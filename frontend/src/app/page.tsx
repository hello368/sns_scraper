"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { VideoItem, LibraryStats, StatusResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getStatus(), api.getStats(), api.getVideos({ limit: 10 })])
      .then(([s, st, v]) => {
        setStatus(s)
        setStats(st)
        setVideos(v)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
        <p className="text-muted-foreground">MediSpa AI 콘텐츠 개요</p>
      </div>

      {/* Stat Cards — API field names: total_videos, downloaded, pending_downloads */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Film}
          label="Total Videos"
          value={status?.total_videos ?? 0}
          description="DB에 저장된 영상"
        />
        <StatCard
          icon={Globe}
          label="Platforms"
          value={Object.keys(totalByPlatform).length}
          description="활성 수집 플랫폼"
        />
        <StatCard
          icon={Download}
          label="Downloaded"
          value={stats?.downloaded ?? 0}
          description="디스크에 저장됨"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={status?.pending_downloads ?? 0}
          description="다운로드 대기 중"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Distribution</CardTitle>
            <CardDescription>플랫폼별 영상 수</CardDescription>
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
            <CardDescription>서비스 및 리소스 상태</CardDescription>
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
          </CardContent>
        </Card>
      </div>

      {/* Recent Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Videos</CardTitle>
          <CardDescription>최근 수집된 10개 영상</CardDescription>
        </CardHeader>
        <CardContent>
          {videos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Downloaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="max-w-[250px]">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 font-medium truncate hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{v.title || v.url?.split("/").pop() || "Untitled"}</span>
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
                        className={CATEGORY_COLORS[v.category] ?? ""}
                        variant="outline"
                      >
                        {v.category || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {v.relevance_score != null ? (
                        <span className="font-mono text-sm">{v.relevance_score}/10</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.downloaded ? (
                        <Badge variant="default" className="bg-green-600">
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
