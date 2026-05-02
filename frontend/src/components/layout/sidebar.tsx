"use client"

import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Search,
  Library,
  Settings,
  Syringe,
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

  return (
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
              className={cn(
                "w-full justify-start gap-3",
                active && "font-medium"
              )}
              onClick={() => router.push(item.href)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="px-6 py-4">
        <p className="text-[11px] text-muted-foreground">MediSpa AI v0.2.0</p>
      </div>
    </aside>
  )
}
