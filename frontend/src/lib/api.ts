import type {
  SearchRequest,
  SearchResponse,
  SearchProgress,
  VideoItem,
  LibraryStats,
  StatusResponse,
  KeywordResponse,
  DownloadResponse,
  LibraryQuery,
} from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

let _authToken = ""

export function setAuthToken(token: string) {
  _authToken = token
}

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (_authToken) {
    headers["Authorization"] = `Bearer ${_authToken}`
  }
  const res = await fetch(url, {
    headers: { ...headers, ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
  // ─── Auth Token ────────────────────────────
  setToken(token: string) {
    _authToken = token
  },

  // ─── Auth ──────────────────────────────────
  login(username: string, password: string): Promise<{ token: string; user: any }> {
    return fetchApi("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
  },

  register(username: string, password: string, email: string): Promise<{ token: string; user: any }> {
    return fetchApi("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    })
  },

  getMe(): Promise<any> {
    return fetchApi("/auth/me")
  },

  // ─── Admin ─────────────────────────────────
  getUsers(): Promise<any[]> {
    return fetchApi("/auth/users")
  },

  createUser(username: string, password: string, email: string, role: string = "user"): Promise<any> {
    return fetchApi("/auth/users", {
      method: "POST",
      body: JSON.stringify({ username, password, email, role }),
    })
  },

  deleteUser(userId: string): Promise<any> {
    return fetchApi(`/auth/users/${userId}`, { method: "DELETE" })
  },

  toggleUser(userId: string): Promise<any> {
    return fetchApi(`/auth/users/${userId}/toggle`, { method: "PATCH" })
  },

  // ─── Status ─────────────────────────────────
  getStatus(): Promise<StatusResponse> {
    return fetchApi("/status")
  },

  // ─── Search ─────────────────────────────────
  search(req: SearchRequest): Promise<SearchResponse> {
    return fetchApi("/search", {
      method: "POST",
      body: JSON.stringify(req),
    })
  },

  getSearchProgress(taskId: string): Promise<SearchProgress> {
    return fetchApi(`/search/progress/${taskId}`)
  },

  stopSearch(taskId: string): Promise<{ task_id: string; status: string; message: string }> {
    return fetchApi(`/search/stop/${taskId}`, { method: "POST" })
  },

  expandKeywords(seeds: string[]): Promise<KeywordResponse> {
    return fetchApi("/keywords", {
      method: "POST",
      body: JSON.stringify({ seeds }),
    })
  },

  // ─── Library ───────────────────────────────
  getVideos(query?: LibraryQuery): Promise<VideoItem[]> {
    const params = new URLSearchParams()
    if (query?.category) params.set("category", query.category)
    if (query?.platform) params.set("platform", query.platform)
    if (query?.region) params.set("region", query.region)
    if (query?.downloaded !== undefined) params.set("downloaded", String(query.downloaded))
    if (query?.limit) params.set("limit", String(query.limit))
    if (query?.offset) params.set("offset", String(query.offset))
    const qs = params.toString()
    return fetchApi<{ total: number; videos: VideoItem[] }>(
      `/library/videos${qs ? `?${qs}` : ""}`
    ).then((r) => r.videos)
  },

  getStats(region?: string): Promise<LibraryStats> {
    const qs = region ? `?region=${region}` : ""
    return fetchApi(`/library/stats${qs}`)
  },

  // ─── Download ──────────────────────────────
  download(videoIds: string[], category?: string): Promise<DownloadResponse> {
    return fetchApi("/download", {
      method: "POST",
      body: JSON.stringify({ video_ids: videoIds, category }),
    })
  },
}
