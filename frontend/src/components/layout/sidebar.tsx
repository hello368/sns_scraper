"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Search,
  Library,
  Settings,
  Syringe,
  LogIn,
  LogOut,
  Shield,
  Loader2,
  Menu,
  X,
} from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading, logout, isAdmin } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const pageTitle = navItems.find((i) => i.href === pathname)?.label || "MediSpa AI"

  function navigate(href: string) {
    setMobileOpen(false)
    router.push(href)
  }

  // ─── Desktop Sidebar (md+) ──────────────────────────────
  const desktopNav = (
    <aside className="hidden md:flex flex-col w-60 border-r bg-sidebar h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Syringe className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">MediSpa AI</p>
          <p className="text-[11px] text-muted-foreground">Content Curator</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Button
              key={item.href}
              variant={active ? "secondary" : "ghost"}
              className={cn("w-full justify-start gap-3", active && "font-medium")}
              onClick={() => router.push(item.href)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}

        {isAdmin && (
          <>
            <Separator className="my-2" />
            <Button
              variant={pathname === "/admin" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => router.push("/admin")}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Button>
          </>
        )}
      </nav>

      <Separator />

      {/* Login / User Info */}
      <div className="px-3 py-3 space-y-1">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : user ? (
          <>
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user.username}</p>
                <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">{user.role}</Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={() => router.push("/login")}
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        )}
      </div>
    </aside>
  )

  // ─── Mobile Header + Drawer ───────────────────────────
  const mobileHeader = (
    <>
      {/* Fixed top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="p-1 h-9 w-9" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Syringe className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">{pageTitle}</span>
          </div>
        </div>
        {!loading && user && (
          <span className="text-xs text-muted-foreground">{user.username}</span>
        )}
      </header>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Slide-out drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r shadow-xl transition-transform duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Syringe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">MediSpa AI</p>
              <p className="text-[11px] text-muted-foreground">Content Curator</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-8 w-8" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={active ? "secondary" : "ghost"}
                className={cn("w-full justify-start gap-3", active && "font-medium")}
                onClick={() => navigate(item.href)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            )
          })}
          {isAdmin && (
            <>
              <Separator className="my-2" />
              <Button
                variant={pathname === "/admin" ? "secondary" : "ghost"}
                className="w-full justify-start gap-3"
                onClick={() => navigate("/admin")}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            </>
          )}
        </nav>

        <Separator />

        <div className="px-3 py-3 space-y-1">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          ) : user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user.username}</p>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">{user.role}</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                onClick={() => { setMobileOpen(false); logout(); }}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={() => navigate("/login")}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
      </aside>
    </>
  )

  // ─── Spacer for mobile sticky header ──────────────
  const mobileSpacer = <div className="md:hidden h-14" />

  return (
    <>
      {desktopNav}
      {mobileHeader}
      {mobileSpacer}
    </>
  )
}
