export interface SearchRequest {
  keywords: string[]
  platforms: string[]
  max_per_keyword: number
  region: string
  use_ai_scoring: boolean
  // ─── New params ─────────
  max_days?: number | null
  min_likes?: number | null
  min_comments?: number | null
  min_views?: number | null
}

export interface SearchResponse {
  task_id: string
  status: string
  total_found: number
  after_dedup: number
  new_videos: number
  platforms_used: string[]
  stopped?: boolean
}

export interface SearchProgress {
  task_id: string
  status: string
  total_steps: number
  completed_steps: number
  current_platform: string
  current_keyword: string
  results_so_far: number
  error: string | null
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
  region: string
  relevance_score: number
  likes: number
  comments: number
  views: number
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
  total_searches?: number
  total_cu_cost?: number
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
  region?: string
  search?: string
  downloaded?: boolean
  sort_by?: "created_at" | "likes" | "comments" | "views" | "relevance_score"
  sort_order?: "asc" | "desc"
  limit?: number
  offset?: number
}

export interface EngagementThresholds {
  tiktok: { minLikes: number; minComments: number; minViews: number }
  instagram: { minLikes: number; minComments: number; minViews: number }
  youtube: { minLikes: number; minComments: number; minViews: number }
  facebook: { minLikes: number; minComments: number; minViews: number }
}
