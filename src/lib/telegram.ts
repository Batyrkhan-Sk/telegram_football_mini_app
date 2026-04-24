'use client'

// Telegram WebApp SDK wrapper
// Provides safe access to window.Telegram.WebApp with demo fallback

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp ?? null
}

export function getTelegramUser(): TelegramUser | null {
  const twa = getTelegramWebApp() as { initDataUnsafe?: { user?: TelegramUser } } | null
  if (twa?.initDataUnsafe?.user) {
    return twa.initDataUnsafe.user
  }

  // Demo mode: return a mock user for local dev
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return {
      id: 100000001,
      first_name: 'Arman',
      last_name: 'Demo',
      username: 'kairat_fan',
    }
  }

  return null
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  const twa = getTelegramWebApp() as {
    HapticFeedback?: {
      impactOccurred?: (t: string) => void
      notificationOccurred?: (t: string) => void
    }
  } | null
  if (!twa?.HapticFeedback) return
  if (type === 'success' || type === 'warning' || type === 'error') {
    twa.HapticFeedback.notificationOccurred?.(type)
  } else {
    twa.HapticFeedback.impactOccurred?.(type)
  }
}

export function showMainButton(text: string, onClick: () => void) {
  const twa = getTelegramWebApp() as {
    MainButton?: {
      setText: (t: string) => void
      show: () => void
      onClick: (fn: () => void) => void
    }
  } | null
  if (!twa?.MainButton) return
  twa.MainButton.setText(text)
  twa.MainButton.show()
  twa.MainButton.onClick(onClick)
}

export function hideMainButton() {
  const twa = getTelegramWebApp() as { MainButton?: { hide: () => void } } | null
  twa?.MainButton?.hide()
}

export function shareToTelegram(url: string, text?: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text ?? '')}`
  const twa = getTelegramWebApp() as { openTelegramLink?: (url: string) => void } | null
  if (twa?.openTelegramLink) {
    twa.openTelegramLink(shareUrl)
  } else {
    window.open(shareUrl, '_blank')
  }
}

export function expandApp() {
  const twa = getTelegramWebApp() as { expand?: () => void; isExpanded?: boolean } | null
  if (twa && !twa.isExpanded) twa.expand?.()
}
