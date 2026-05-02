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
  author: string
  thumbnail_url: string
  duration: number
  category: string
  relevance_score: number
  downloaded: boolean
  file_path: string
  file_size: number
  created_at: string
}

export interface LibraryStats {
  total_videos: number
  by_platform: Record<string, number>
  by_category: Record<string, number>
  downloaded_count: number
  pending_downloads: number
}

export interface StatusResponse {
  status: string
  apify_configured: boolean
  deepseek_configured: boolean
  total_videos: number
  pending_downloads: number
  disk_usage_pct: number
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
