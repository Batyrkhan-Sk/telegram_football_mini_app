'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Swords, QrCode, Star, Zap, Shield, Target, Wind } from 'lucide-react'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { SnickersTitleSelector } from '@/components/SnickersTitleSelector'
import { XpBar, Skeleton } from '@/components/ui'
import { formatXP } from '@/lib/utils'
import { xpProgressToNextLevel } from '@/lib/battle/engine'
import type { UserCard } from '@/types'

export default function ProfilePage() {
  const { user } = useUserStore()
  const profile = user?.profile

  const { data: cardsData } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: () => fetch(`/api/cards?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const { data: battleData } = useQuery({
    queryKey: ['battles', user?.telegramId],
    queryFn: () => fetch(`/api/battle?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const xpProgress = profile ? xpProgressToNextLevel(profile.xp) : null
  const cards = cardsData?.data ?? []
  const battles = battleData?.data ?? []
  const winRate = profile?.battlesPlayed
    ? Math.round(((profile.battlesWon ?? 0) / profile.battlesPlayed) * 100)
    : 0
  const legendaryCards = cards.filter((c) => c.card.rarity === 'LEGENDARY').length
  const epicCards = cards.filter((c) => c.card.rarity === 'EPIC').length

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-full w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="relative overflow-hidden bg-gradient-to-b from-yellow-950/60 via-surface-2 to-surface-0 px-4 pt-6 pb-8">
        <div className="snickers-strip h-1 absolute top-0 left-0 right-0" />

        <div className="flex flex-col items-center text-center gap-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 border-2 border-yellow-400/30 flex items-center justify-center text-4xl">
              ⚽
            </div>
            <div className="absolute -bottom-2 -right-2 bg-brand text-black text-xs font-display font-900 px-2 py-0.5 rounded-lg">
              Lv{profile?.level}
            </div>
          </motion.div>

          <div>
            <h1 className="font-display font-900 text-2xl uppercase">
              {user.firstName ?? user.username ?? 'Player'}
            </h1>
            <p className="text-gray-400 text-sm">@{user.username ?? 'player'}</p>
            <div className="mt-1.5">
              <SnickersTitleSelector />
            </div>
          </div>

          {xpProgress && (
            <div className="w-full max-w-xs">
              <XpBar
                current={xpProgress.current}
                needed={xpProgress.needed}
                pct={xpProgress.pct}
                level={profile?.level ?? 1}
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Zap, label: 'Total XP', value: formatXP(profile?.xp ?? 0), color: 'text-brand' },
            { icon: Trophy, label: 'Coins', value: profile?.coins ?? 0, color: 'text-yellow-300' },
            { icon: Swords, label: 'Battles Won', value: profile?.battlesWon ?? 0, color: 'text-green-400' },
            { icon: Target, label: 'Win Rate', value: `${winRate}%`, color: 'text-blue-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-surface-2 border border-white/6 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className={color} />
                <span className="text-[10px] font-display uppercase text-gray-400">{label}</span>
              </div>
              <p className={`font-display font-900 text-xl ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
          <h3 className="font-display font-800 text-sm uppercase text-gray-300 mb-3">Collection</h3>
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            {[
              { label: 'Total', value: cards.length, color: 'text-white' },
              { label: 'Legend', value: legendaryCards, color: 'text-yellow-400' },
              { label: 'Epic', value: epicCards, color: 'text-purple-400' },
              { label: 'Active', value: cards.filter((c) => !c.isExhausted).length, color: 'text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-surface-3 rounded-xl p-2">
                <p className={`font-display font-900 text-lg ${color}`}>{value}</p>
                <p className="text-[9px] text-gray-500 uppercase">{label}</p>
              </div>
            ))}
          </div>
          <Link href="/cards" className="flex items-center justify-center gap-1 text-brand font-display font-700 text-xs uppercase">
            View All Cards
          </Link>
        </div>

        {battles.length > 0 && (
          <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
            <h3 className="font-display font-800 text-sm uppercase text-gray-300 mb-3">Recent Battles</h3>
            <div className="space-y-2">
              {battles.slice(0, 4).map((b: any) => {
                const won = b.winnerId === user.id
                const isDraw = !b.winnerId
                return (
                  <div key={b.id} className="flex items-center gap-3 bg-surface-3 rounded-xl px-3 py-2.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${won ? 'bg-green-400' : isDraw ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    <div className="flex-1">
                      <p className="font-display font-700 text-sm">
                        vs {b.player2?.firstName ?? b.player2?.username ?? 'Opponent'}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {b.format === 'ONE_V_ONE' ? '1v1' : '3v3'} · {b.resultSummary?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-display font-800 text-sm ${won ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-red-400'}`}>
                        {won ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                      </p>
                      <p className="text-[10px] text-brand">+{b.xpGained} XP</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-red-600/20 flex items-center justify-center">
              <QrCode size={11} className="text-red-400" />
            </div>
            <h3 className="font-display font-800 text-sm uppercase">SNICKERS Campaign</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'QR Scans', value: profile?.qrScansUsed ?? 0 },
              { label: 'AR Sessions', value: profile?.arSessionsPlayed ?? 0 },
              { label: 'Battles', value: profile?.battlesPlayed ?? 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-3 rounded-xl p-2">
                <p className="font-display font-900 text-xl text-white">{value}</p>
                <p className="text-[9px] text-gray-500 uppercase">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
