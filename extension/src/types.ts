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

export interface PendingFashionCapture {
  imageUrl: string
  sourceUrl: string
  sourceTitle: string
  timestamp: number
}

export interface PendingLocationCapture {
  imageUrl: string
  sourceUrl: string
  sourceTitle: string
  timestamp: number
}

export interface PendingPoseCapture {
  imageUrl: string
  sourceUrl: string
  sourceTitle: string
  timestamp: number
}

export interface OutfitImage {
  imageUrl: string
  sourceUrl: string
  sourceTitle: string
}

export interface PendingOutfitCapture {
  images: OutfitImage[]
  timestamp: number
}

export interface PendingFashionImageAdd {
  imageUrl: string
  sourceUrl: string
  sourceTitle: string
  timestamp: number
}
