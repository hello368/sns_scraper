export interface SearchRequest {
  keywords: string[]
  platforms: string[]
  max_per_keyword: number
  use_ai_scoring: boolean
}

export interface SearchResponse {
  task_id: string
  status: string
  total_found: number
  after_dedup: number
  new_videos: number
  platforms_used: string[]
}

export interface VideoItem {
  id: string
  url: string
  platform: string
  title: string
  description: string
  thumbnail_url: string
  username: string
  category: string
  relevance_score: number
  downloaded: boolean
  filepath: string
  filesize_bytes: number
  duration_sec: number
  created_at: string
}

export interface LibraryStats {
  total_videos: number
  downloaded: number
  total_size_mb: number
  by_platform: Record<string, number>
  by_category: Record<string, number>
}

export interface StatusResponse {
  status: string
  apify_configured: boolean
  deepseek_configured: boolean
  total_videos: number
  downloaded_videos?: number
  pending_downloads?: number
  disk_usage_pct: number
  disk_free_gb?: number
}

export interface KeywordResponse {
  keywords: string[]
  count: number
}

export interface DownloadResponse {
  task_id: string
  status: string
  queued_count: number
}

export interface LibraryQuery {
  category?: string
  platform?: string
  downloaded?: boolean
  limit?: number
  offset?: number
}
