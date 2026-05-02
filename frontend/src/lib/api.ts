import type {
  SearchRequest,
  SearchResponse,
  VideoItem,
  LibraryStats,
  StatusResponse,
  KeywordResponse,
  DownloadResponse,
  LibraryQuery,
} from "./types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
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
