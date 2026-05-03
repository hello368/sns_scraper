"use client"

import { useEffect, useState, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Shield,
  UserPlus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Users,
} from "lucide-react"

interface AdminUser {
  id: string
  username: string
  email: string
  role: string
  is_active: number
  created_at: string
  last_login: string
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ username: "", password: "", email: "", role: "user" })
  const [creating, setCreating] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) fetchUsers()
    else setLoading(false)
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
    } catch (err) {
      toast.error("Delete failed")
    }
  }

  async function handleToggle(userId: string) {
    try {
      const updated = await api.toggleUser(userId)
      toast.success(`User ${updated.username} toggled`)
      fetchUsers()
    } catch (err) {
      toast.error("Toggle failed")
    }
  }

  // Not admin → show access denied
  if (!isAdmin && !loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Access Denied</p>
            <p className="text-sm text-muted-foreground/60">Admin privileges required</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">User management</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {showForm ? "Cancel" : "Add User"}
        </Button>
      </div>

      {/* Create User Form */}
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
                <option value="user">User</option>
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

      {/* User List */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
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
    </div>
  )
}
