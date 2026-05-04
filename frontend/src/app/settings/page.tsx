"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { StatusResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Syringe,
  Brain,
  HardDrive,
  Server,
  Database,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

function InfoRow({
  label,
  value,
  icon: Icon,
  badge,
}: {
  label: string
  value?: string | number
  icon?: React.ElementType
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge || (value != null ? <span className="text-sm font-medium">{value}</span> : null)}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .getStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Loading system info...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">System Settings & Status</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5" />
              API Services
            </CardTitle>
            <CardDescription>External Service Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              label="Apify"
              icon={Syringe}
              badge={
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
              }
            />
            <Separator />
            <InfoRow
              label="DeepSeek AI"
              icon={Brain}
              badge={
                <Badge
                  variant={
                    status?.deepseek_configured ? "default" : "destructive"
                  }
                  className="gap-1"
                >
                  {status?.deepseek_configured ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {status?.deepseek_configured ? "Connected" : "Disconnected"}
                </Badge>
              }
            />
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              System Resources
            </CardTitle>
            <CardDescription>Server Resource Usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow
              label="Disk Usage"
              icon={HardDrive}
              badge={
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
              }
            />
            <Separator />
            <InfoRow label="Backend API" value="http://localhost:8000" icon={Globe} />
          </CardContent>
        </Card>

        {/* Database Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
            <CardDescription>SQLite Storage Status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Total Videos" value={status?.total_videos ?? 0} icon={Database} />
            <Separator />
            <InfoRow
              label="Pending Downloads"
              value={status?.pending_downloads ?? 0}
              icon={Clock}
            />
          </CardContent>
        </Card>

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Project Info
            </CardTitle>
            <CardDescription>MediSpa AI Info</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            <InfoRow label="Version" value="v0.2.0" />
            <Separator />
            <InfoRow label="Framework" value="Next.js 16 + FastAPI" />
            <Separator />
            <InfoRow label="Database" value="SQLite" />
            <Separator />
            <InfoRow label="AI Model" value="DeepSeek V4 Flash" />
          </CardContent>
        </Card>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">System Health</CardTitle>
          <CardDescription>System Status Summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {status?.apify_configured && status?.deepseek_configured ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium">All Systems Operational</p>
                  <p className="text-sm text-muted-foreground">
                    All API services are connected and working properly
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="font-medium">Partial Outage</p>
                  <p className="text-sm text-muted-foreground">
                    Some API services are not configured
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


