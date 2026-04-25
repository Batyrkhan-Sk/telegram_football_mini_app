'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Swords, LayoutGrid, User2, Trophy, QrCode, Zap, ChevronRight, Timer, Star } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { SnickersTitleSelector } from '@/components/SnickersTitleSelector'
import { XpBar, Skeleton } from '@/components/ui'
import { formatXP, isOnCooldown, formatTimeLeft } from '@/lib/utils'
import { xpProgressToNextLevel } from '@/lib/battle/engine'
import { useQuery } from '@tanstack/react-query'
import type { UserCard } from '@/types'

function CooldownBanner({ endAt }: { endAt: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
      <Timer size={14} className="text-red-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-xs font-display font-700 text-red-400">Card on Cooldown</p>
        <p className="text-[10px] text-gray-400">Restores in {formatTimeLeft(endAt)}</p>
      </div>
      <Link href="/scan" className="text-[10px] font-display font-700 text-brand uppercase">
        Skip
      </Link>
    </div>
  )
}

const QUICK_ACTIONS = [
  { href: '/battle', icon: Swords, label: 'Battle', desc: 'Challenge opponents', color: '#C8102E' },
  { href: '/cards', icon: LayoutGrid, label: 'My Cards', desc: 'View collection', color: '#F5C518' },
  { href: '/character', icon: User2, label: 'My Player', desc: 'Create character', color: '#A855F7' },
  { href: '/ar', icon: Star, label: 'Penalty', desc: 'Game mode', color: '#22C55E' },
]

export default function HomePage() {
  const { user, isLoading } = useUserStore()
  const router = useRouter()

  const { data: cardsData } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: () => fetch(`/api/cards?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const profile = user?.profile
  const xpProgress = profile ? xpProgressToNextLevel(profile.xp) : null
  const exhaustedCards = cardsData?.data?.filter((c) => c.isOnCooldown) ?? []
  const cooldownEnd = exhaustedCards[0]?.cooldownEndAt ?? null

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen p-4 gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center gap-4">
        <div className="text-5xl">⚽</div>
        <h1 className="font-display font-900 text-3xl uppercase">KAIRAT × SNICKERS</h1>
        <p className="text-gray-400 text-sm">Open this app inside Telegram to play.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Header banner */}
      <div className="relative overflow-hidden">
        <div className="snickers-strip h-1 w-full" />
        <div className="bg-gradient-to-b from-surface-2 to-surface-0 px-4 pt-4 pb-6">
          {/* Top row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border border-yellow-400/20 flex items-center justify-center text-2xl">
                ⚽
              </div>
              <div className="absolute -bottom-1 -right-1 bg-brand text-black text-[9px] font-display font-900 px-1 rounded">
                Lv{profile?.level}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-900 text-xl uppercase leading-none">
                  {user.firstName ?? user.username ?? 'Player'}
                </h1>
                <SnickersTitleSelector compact editable={false} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">@{user.username ?? 'player'}</p>
            </div>
            <Link href="/profile" className="p-2 rounded-xl bg-surface-3 border border-white/5">
              <User2 size={18} className="text-gray-400" />
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-surface-3 rounded-xl p-2.5 border border-white/5">
              <p className="text-[10px] font-display text-gray-400 uppercase">XP</p>
              <p className="font-display font-900 text-lg text-brand leading-none">{formatXP(profile?.xp ?? 0)}</p>
            </div>
            <div className="flex-1 bg-surface-3 rounded-xl p-2.5 border border-white/5">
              <p className="text-[10px] font-display text-gray-400 uppercase">Coins</p>
              <p className="font-display font-900 text-lg text-yellow-300 leading-none">{profile?.coins ?? 0}</p>
            </div>
            <div className="flex-1 bg-surface-3 rounded-xl p-2.5 border border-white/5">
              <p className="text-[10px] font-display text-gray-400 uppercase">Wins</p>
              <p className="font-display font-900 text-lg text-white leading-none">{profile?.battlesWon ?? 0}</p>
            </div>
          </div>

          {xpProgress && (
            <XpBar
              current={xpProgress.current}
              needed={xpProgress.needed}
              pct={xpProgress.pct}
              level={profile?.level ?? 1}
            />
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Cooldown warning */}
        {cooldownEnd && isOnCooldown(cooldownEnd) && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <CooldownBanner endAt={cooldownEnd} />
          </motion.div>
        )}

        {/* SNICKERS promo strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            href="/scan"
            className="flex items-center gap-3 bg-gradient-to-r from-red-950/80 via-red-900/60 to-red-950/80 border border-red-800/40 rounded-2xl px-4 py-3"
          >
            <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0">
              <QrCode size={20} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-display font-800 text-sm text-red-300 uppercase tracking-wide">
                Scan SNICKERS QR
              </p>
              <p className="text-[10px] text-red-400/70">Restore cards instantly · Bypass cooldowns</p>
            </div>
            <ChevronRight size={16} className="text-red-400" />
          </Link>
        </motion.div>

        {/* Quick actions */}
        <div>
          <h2 className="font-display font-800 text-base uppercase tracking-wider text-gray-400 mb-2">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc, color }, i) => (
              <motion.div
                key={href}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i + 0.15 }}
              >
                <Link
                  href={href}
                  className="flex flex-col gap-2 bg-surface-2 border border-white/6 rounded-2xl p-3.5 active:scale-95 transition-transform"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${color}22` }}
                  >
                    <Icon size={20} style={{ color }} />
                  </div>
                  <div>
                    <p className="font-display font-800 text-base uppercase leading-tight">{label}</p>
                    <p className="text-[10px] text-gray-500">{desc}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Campaign stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-surface-2 border border-white/6 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-brand/20 flex items-center justify-center">
              <Star size={11} className="text-brand" />
            </div>
            <h3 className="font-display font-800 text-sm uppercase tracking-wider">Campaign Stats</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Cards Collected', value: cardsData?.data?.length ?? 0 },
              { label: 'Battles Played', value: profile?.battlesPlayed ?? 0 },
              { label: 'QR Scans', value: profile?.qrScansUsed ?? 0 },
              { label: 'Win Rate', value: profile?.battlesPlayed
                ? `${Math.round(((profile.battlesWon ?? 0) / profile.battlesPlayed) * 100)}%`
                : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-3 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-400 uppercase">{label}</p>
                <p className="font-display font-800 text-base text-white">{value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Leaderboard teaser */}
        <Link
          href="/leaderboard"
          className="flex items-center gap-3 bg-surface-2 border border-white/6 rounded-2xl p-4"
        >
          <Trophy size={20} className="text-brand" />
          <div className="flex-1">
            <p className="font-display font-800 text-sm uppercase">Leaderboard</p>
            <p className="text-[10px] text-gray-400">Where you rank in KZ</p>
          </div>
          <ChevronRight size={16} className="text-gray-500" />
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
