import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXP(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`
  return xp.toString()
}

export function formatTimeLeft(endAt: string | null): string {
  if (!endAt) return ''
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return 'Ready'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function isOnCooldown(endAt: string | null): boolean {
  if (!endAt) return false
  return new Date(endAt).getTime() > Date.now()
}

export function getAvatarUrl(username: string | null, firstName: string | null): string {
  const name = firstName ?? username ?? 'Player'
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=b6e3f4,c0aede,d1d4f9`
}

export function getRankLabel(level: number): string {
  if (level >= 15) return 'Мазасыз'
  if (level >= 10) return 'Душнила'
  if (level >= 7) return 'Ұмытшақ'
  if (level >= 4) return 'В тильте'
  return 'Не в теме'
}

export function getResultEmoji(summary: string): { emoji: string; label: string } {
  const map: Record<string, { emoji: string; label: string }> = {
    GOAL_SCORED: { emoji: '⚽', label: 'GOAL!' },
    SAVE_MADE: { emoji: '🧤', label: 'SAVED!' },
    COUNTERATTACK_WIN: { emoji: '💨', label: 'COUNTER!' },
    PENALTY_WIN: { emoji: '🎯', label: 'PENALTY!' },
    HEADER_WIN: { emoji: '🔛', label: 'HEADER!' },
    FREEKICK_WIN: { emoji: '🌀', label: 'FREE KICK!' },
  }
  return map[summary] ?? { emoji: '⚽', label: 'MATCH OVER' }
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
