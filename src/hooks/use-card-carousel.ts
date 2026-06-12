'use client'

import { useState, useEffect, useRef } from 'react'
import type { PreviewMediaItem } from './use-prompts'

export function useCardCarousel(previewMedia: PreviewMediaItem[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isCarouselActive, setIsCarouselActive] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function onMouseEnter() {
    if (previewMedia.length <= 1) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setIsCarouselActive(true)
      if (!reducedMotionRef.current) {
        intervalRef.current = setInterval(() => {
          setCurrentIndex(prev => (prev + 1) % previewMedia.length)
        }, 1500)
      }
    }, 200)
  }

  function onMouseLeave() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    debounceRef.current = null
    intervalRef.current = null
    setIsCarouselActive(false)
    setCurrentIndex(0)
  }

  return { currentIndex, isCarouselActive, onMouseEnter, onMouseLeave }
}
