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
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return { id: 100000001, first_name: 'Arman', last_name: 'Demo', username: 'kairat_fan' }
  }
  const twa = getTelegramWebApp() as { initDataUnsafe?: { user?: TelegramUser } } | null
  if (twa?.initDataUnsafe?.user) {
    return twa.initDataUnsafe.user
  }
  return null
}

export function getTelegramStartParam(): string | null {
  const twa = getTelegramWebApp() as { initDataUnsafe?: { start_param?: string } } | null
  return twa?.initDataUnsafe?.start_param ?? null
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

export function shareBattleToTelegram(challengeId: string, fallbackUrl: string, text?: string) {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.replace(/^@/, '')
  const appName = process.env.NEXT_PUBLIC_TELEGRAM_APP_NAME
  const startParam = `battle_${challengeId}`
  const miniAppUrl = botUsername && appName
    ? `https://t.me/${botUsername}/${appName}?startapp=${encodeURIComponent(startParam)}`
    : fallbackUrl

  shareToTelegram(miniAppUrl, text)
}

export function expandApp() {
  const twa = getTelegramWebApp() as { expand?: () => void; isExpanded?: boolean } | null
  if (twa && !twa.isExpanded) twa.expand?.()
}

// ─── Native QR Scanner ────────────────────────────────────────────────────────
// Uses Telegram's built-in showScanQrPopup — works on iOS + Android natively.
// No camera permissions dialog, no BarcodeDetector compatibility issues.
// Not available on Telegram Web (desktop browser) — falls back gracefully.

type ScanCallback = (code: string | null) => void

type TwaWithQr = {
  showScanQrPopup?: (
    params: { text?: string },
    callback?: (text: string) => boolean | void
  ) => void
  closeScanQrPopup?: () => void
}

/**
 * Opens Telegram's native QR scanner popup.
 * Returns true if the native scanner was opened, false if unavailable.
 * When unavailable (desktop/web), the caller should show the manual input instead.
 */
export function scanQrCode(callback: ScanCallback): boolean {
  const twa = getTelegramWebApp() as TwaWithQr | null

  if (!twa?.showScanQrPopup) {
    // Not inside Telegram mobile app — caller should show manual input fallback
    return false
  }

  twa.showScanQrPopup(
    { text: 'Scan your SNICKERS pack QR code' },
    (rawText: string) => {
      // Extract last path segment if it's a URL (e.g. https://snickers.kz/GOLD-BAR-001)
      const code = rawText.includes('/')
        ? rawText.split('/').pop()?.trim().toUpperCase() ?? rawText.toUpperCase()
        : rawText.trim().toUpperCase()

      callback(code)
      return true // returning true auto-closes the popup after first scan
    }
  )

  return true
}

export function closeScanQrPopup(): void {
  const twa = getTelegramWebApp() as TwaWithQr | null
  twa?.closeScanQrPopup?.()
}