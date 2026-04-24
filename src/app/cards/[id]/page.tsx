'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, QrCode, Zap } from 'lucide-react'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { StatBar, Badge, LoadingSpinner } from '@/components/ui'
import { RARITY_CONFIG, POSITION_LABELS } from '@/config/game'
import { formatTimeLeft, isOnCooldown } from '@/lib/utils'
import type { UserCard } from '@/types'

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUserStore()
  const router = useRouter()

  const { data, isLoading } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: () => fetch(`/api/cards?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const userCard = data?.data?.find((c) => c.id === id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  if (!userCard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-400">Card not found</p>
        <Link href="/cards" className="text-brand text-sm">← Back to cards</Link>
      </div>
    )
  }

  const { card, energy, maxEnergy, cooldownEndAt } = userCard
  const cfg = RARITY_CONFIG[card.rarity]
  const exhausted = userCard.isExhausted || userCard.isOnCooldown
  const energyPct = Math.round((energy / maxEnergy) * 100)

  const RARITY_BG: Record<string, string> = {
    LEGENDARY: 'from-yellow-950 via-yellow-900/50 to-surface-0',
    EPIC:      'from-purple-950 via-purple-900/50 to-surface-0',
    RARE:      'from-blue-950 via-blue-900/50 to-surface-0',
    COMMON:    'from-zinc-900 via-zinc-800/50 to-surface-0',
  }

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className={`bg-gradient-to-b ${RARITY_BG[card.rarity]} relative overflow-hidden`}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button onClick={() => router.back()} className="p-2 rounded-xl bg-black/20">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display font-800 text-xl uppercase flex-1 truncate">{card.playerName}</h1>
          <Badge variant={card.rarity === 'LEGENDARY' ? 'brand' : 'gray'}>{cfg.label}</Badge>
        </div>

        {/* Hero */}
        <div className="flex flex-col items-center py-8">
          <div className="text-9xl select-none mb-2">
            {card.position === 'GK' ? '🧤' : card.position === 'DEF' ? '🛡️' : card.position === 'MID' ? '⚡' : '⚽'}
          </div>
          <div className="font-display font-900 text-3xl uppercase">{card.playerName}</div>
          <div className="text-sm text-gray-400 mt-1">{card.club} · {POSITION_LABELS[card.position]}</div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Energy status */}
        <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className={exhausted ? 'text-red-400' : 'text-brand'} />
              <span className="font-display font-700 text-sm uppercase">Card Energy</span>
            </div>
            <span className={`font-display font-800 text-sm ${exhausted ? 'text-red-400' : 'text-brand'}`}>
              {exhausted ? (isOnCooldown(cooldownEndAt) ? `${formatTimeLeft(cooldownEndAt)} left` : 'DRAINED') : `${energyPct}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-1">
            <div
              className={`h-full rounded-full transition-all ${energyPct > 30 ? 'energy-bar' : 'energy-bar-low'}`}
              style={{ width: `${energyPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>{energy} / {maxEnergy}</span>
            <span>Used {userCard.timesUsed}×</span>
          </div>

          {exhausted && (
            <Link
              href="/scan"
              className="flex items-center justify-center gap-2 mt-3 bg-red-500/15 border border-red-500/30 text-red-400 font-display font-700 uppercase text-sm py-2.5 rounded-xl"
            >
              <QrCode size={16} />
              Scan SNICKERS to Restore
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="bg-surface-2 border border-white/6 rounded-2xl p-4">
          <h3 className="font-display font-800 text-sm uppercase mb-3 text-gray-300">Player Stats</h3>
          <div className="space-y-2.5">
            <StatBar label="Speed" value={card.stats.speed} color={cfg.color} />
            <StatBar label="Shot" value={card.stats.shot} color={cfg.color} />
            <StatBar label="Drib" value={card.stats.dribbling} color={cfg.color} />
            <StatBar label="Phys" value={card.stats.physical} color={cfg.color} />
            <StatBar label="Def" value={card.stats.defense} color={cfg.color} />
          </div>
        </div>

        {/* Use in battle */}
        {!exhausted && (
          <Link
            href="/battle"
            className="flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-base py-3.5 rounded-2xl"
          >
            Use in Battle →
          </Link>
        )}
      </div>
    </div>
  )
}
