"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { api, setAuthToken } from "@/lib/api"
import { useRouter } from "next/navigation"

export interface User {
  id: string
  username: string
  email: string
  role: string
  is_active: number
  created_at: string
  last_login: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
  refresh: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

const TOKEN_KEY = "medispa_auth_token"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      setToken(saved)
      // Validate by fetching /auth/me
      setAuthToken(saved)
      api
        .getMe()
        .then((u) => setUser(u))
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem(TOKEN_KEY)
          setAuthToken("")
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password)
      localStorage.setItem(TOKEN_KEY, res.token)
      setAuthToken(res.token)
      setToken(res.token)
      setUser(res.user)
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken("")
    setToken(null)
    setUser(null)
    router.push("/login")
  }, [router])

  const refresh = useCallback(async () => {
    try {
      const u = await api.getMe()
      setUser(u)
    } catch {
      setUser(null)
      setToken(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        isAdmin: user?.role === "admin",
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
