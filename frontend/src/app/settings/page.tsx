"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import type { StatusResponse } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
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
  Shield,
  Users,
  UserPlus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
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
  const { user, isAdmin, logout } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // ─── Admin: User Management ─────────────────────────────
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ username: "", password: "", email: "", role: "user" })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api
      .getStatus()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch {
      // silent
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  async function handleCreate() {
    if (!formData.username || !formData.password || !formData.email) {
      toast.error("Fill all fields")
      return
    }
    setCreating(true)
    try {
      await api.createUser(formData.username, formData.password, formData.email, formData.role)
      toast.success(`User ${formData.username} created`)
      setShowForm(false)
      setFormData({ username: "", password: "", email: "", role: "user" })
      fetchUsers()
    } catch (err) {
      toast.error("Create failed: " + (err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(userId: string, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try {
      await api.deleteUser(userId)
      toast.success(`User ${username} deleted`)
      fetchUsers()
    } catch {
      toast.error("Delete failed")
    }
  }

  async function handleToggle(userId: string) {
    try {
      const updated = await api.toggleUser(userId)
      toast.success(`User ${updated.username} toggled`)
      fetchUsers()
    } catch {
      toast.error("Toggle failed")
    }
  }

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
            <InfoRow label="Backend API" value="https://medispa-api.ngrok-free.dev" icon={Globe} />
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

      {/* ─── Admin: User Management ──────────────────────── */}
      {isAdmin && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">User Management</h2>
              <p className="text-sm text-muted-foreground">Manage admin & staff accounts</p>
            </div>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {showForm ? "Cancel" : "Add User"}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create User</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <Input
                    placeholder="Password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <select
                    className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="user">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create User"}
                </Button>
              </CardContent>
            </Card>
          )}

          {users.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {users.map((u: any) => (
                <Card key={u.id} className={u.is_active ? "" : "opacity-50"}>
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.username}</span>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                          {u.role}
                        </Badge>
                        {!u.is_active && (
                          <Badge variant="outline" className="text-[10px] text-destructive">
                            disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        Created: {u.created_at?.slice(0, 10) || "?"}
                        {u.last_login ? ` · Last login: ${u.last_login?.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(u.id)}
                        title={u.is_active ? "Disable" : "Enable"}
                      >
                        {u.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(u.id, u.username)}
                        disabled={u.id === user?.id}
                        title={u.id === user?.id ? "Cannot delete yourself" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Logged in user info */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="Username" value={user.username} />
            <Separator />
            <InfoRow label="Role" value={user.role} />
            <Separator />
            <InfoRow label="Email" value={user.email} />
            <Separator />
            <Button variant="outline" className="w-full mt-2 text-destructive" onClick={logout}>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


