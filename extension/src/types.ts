export interface Prompt {
  id: string
  title: string
  description: string | null
  content: string
  tags: string[] | null
  is_favorite: boolean
  last_used_at: string | null
  usage_count: number
  created_at: string
}

export interface PendingCapture {
  content: string
  source_url: string
  title: string
  timestamp: number
}
