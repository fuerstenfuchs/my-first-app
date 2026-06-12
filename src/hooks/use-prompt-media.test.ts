import { describe, it, expect } from 'vitest'
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  IMAGE_MAX,
  VIDEO_MAX,
  isVideoUrl,
  validateMediaFile,
} from './use-prompt-media'

describe('PROJ-8 media validation constants', () => {
  it('IMAGE_TYPES contains expected MIME types', () => {
    expect(IMAGE_TYPES).toContain('image/jpeg')
    expect(IMAGE_TYPES).toContain('image/png')
    expect(IMAGE_TYPES).toContain('image/webp')
    expect(IMAGE_TYPES).toContain('image/gif')
  })

  it('VIDEO_TYPES contains expected MIME types', () => {
    expect(VIDEO_TYPES).toContain('video/mp4')
    expect(VIDEO_TYPES).toContain('video/webm')
    expect(VIDEO_TYPES).toContain('video/quicktime')
  })

  it('IMAGE_MAX is exactly 20 MB', () => {
    expect(IMAGE_MAX).toBe(20 * 1024 * 1024)
  })

  it('VIDEO_MAX is exactly 100 MB', () => {
    expect(VIDEO_MAX).toBe(100 * 1024 * 1024)
  })
})

describe('isVideoUrl', () => {
  it('returns true for .mp4 URLs', () => {
    expect(isVideoUrl('https://example.com/clip.mp4')).toBe(true)
    expect(isVideoUrl('https://storage.example.com/user/id/clip.MP4')).toBe(true)
  })

  it('returns true for .webm URLs', () => {
    expect(isVideoUrl('https://example.com/clip.webm')).toBe(true)
  })

  it('returns true for .mov URLs', () => {
    expect(isVideoUrl('https://example.com/clip.mov')).toBe(true)
  })

  it('returns true for video URLs with query params', () => {
    expect(isVideoUrl('https://example.com/clip.mp4?token=abc')).toBe(true)
  })

  it('returns false for image URLs', () => {
    expect(isVideoUrl('https://example.com/photo.jpg')).toBe(false)
    expect(isVideoUrl('https://example.com/photo.png')).toBe(false)
    expect(isVideoUrl('https://example.com/photo.webp')).toBe(false)
    expect(isVideoUrl('https://example.com/photo.gif')).toBe(false)
  })

  it('returns false for URLs that contain .mp4 in the path but not as extension', () => {
    // e.g. a folder named "mp4" but file is .jpg
    expect(isVideoUrl('https://example.com/mp4-files/photo.jpg')).toBe(false)
  })
})

describe('validateMediaFile', () => {
  function makeFile(name: string, type: string, size: number) {
    return { name, type, size }
  }

  it('accepts a valid JPEG image under 20 MB', () => {
    const result = validateMediaFile(makeFile('photo.jpg', 'image/jpeg', 1024 * 1024))
    expect(result).toBeNull()
  })

  it('accepts a valid PNG image at exactly 20 MB', () => {
    const result = validateMediaFile(makeFile('photo.png', 'image/png', IMAGE_MAX))
    expect(result).toBeNull()
  })

  it('rejects a JPEG image over 20 MB', () => {
    const result = validateMediaFile(makeFile('big.jpg', 'image/jpeg', IMAGE_MAX + 1))
    expect(result).toContain('big.jpg')
    expect(result).toContain('20 MB')
  })

  it('accepts a valid MP4 video under 100 MB', () => {
    const result = validateMediaFile(makeFile('video.mp4', 'video/mp4', 50 * 1024 * 1024))
    expect(result).toBeNull()
  })

  it('accepts a valid video at exactly 100 MB', () => {
    const result = validateMediaFile(makeFile('video.mp4', 'video/mp4', VIDEO_MAX))
    expect(result).toBeNull()
  })

  it('rejects a video over 100 MB', () => {
    const result = validateMediaFile(makeFile('big.mp4', 'video/mp4', VIDEO_MAX + 1))
    expect(result).toContain('big.mp4')
    expect(result).toContain('100 MB')
  })

  it('rejects unsupported file types (PDF)', () => {
    const result = validateMediaFile(makeFile('doc.pdf', 'application/pdf', 1024))
    expect(result).toContain('doc.pdf')
    expect(result).toContain('nicht unterstützt')
  })

  it('rejects unsupported video formats (AVI)', () => {
    const result = validateMediaFile(makeFile('clip.avi', 'video/avi', 1024))
    expect(result).toContain('clip.avi')
    expect(result).toContain('nicht unterstützt')
  })

  it('accepts WebP images', () => {
    const result = validateMediaFile(makeFile('photo.webp', 'image/webp', 1024))
    expect(result).toBeNull()
  })

  it('accepts GIF images', () => {
    const result = validateMediaFile(makeFile('anim.gif', 'image/gif', 1024))
    expect(result).toBeNull()
  })

  it('accepts WebM videos', () => {
    const result = validateMediaFile(makeFile('clip.webm', 'video/webm', 1024))
    expect(result).toBeNull()
  })

  it('accepts QuickTime videos (MOV)', () => {
    const result = validateMediaFile(makeFile('clip.mov', 'video/quicktime', 1024))
    expect(result).toBeNull()
  })
})
