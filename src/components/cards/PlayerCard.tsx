'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { RARITY_CONFIG, POSITION_LABELS } from '@/config/game'
import type { UserCard } from '@/types'
import { Zap, Clock, UserRound } from 'lucide-react'
import { formatTimeLeft } from '@/lib/utils'

interface CardProps {
  userCard: UserCard
  selected?: boolean
  onClick?: () => void
  compact?: boolean
}

const RARITY_BG: Record<string, string> = {
  LEGENDARY: 'from-yellow-950 via-yellow-900 to-yellow-950',
  EPIC:      'from-purple-950 via-purple-900 to-purple-950',
  RARE:      'from-blue-950 via-blue-900 to-blue-950',
  COMMON:    'from-zinc-900 via-zinc-800 to-zinc-900',
}

const RARITY_BORDER: Record<string, string> = {
  LEGENDARY: 'border-yellow-400/60',
  EPIC:      'border-purple-500/60',
  RARE:      'border-blue-500/60',
  COMMON:    'border-zinc-600/60',
}

const POSITION_COLORS: Record<string, string> = {
  GK: '#22c55e', DEF: '#3b82f6', MID: '#f59e0b', FWD: '#ef4444',
}

export function PlayerCard({ userCard, selected, onClick, compact }: CardProps) {
  const { card, energy, maxEnergy, cooldownEndAt, isExhausted, isOnCooldown } = userCard
  const rarity = card.rarity
  const cfg = RARITY_CONFIG[rarity]
  const energyPct = Math.round((energy / maxEnergy) * 100)
  const exhausted = isExhausted || isOnCooldown

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'relative flex items-center gap-3 w-full p-3 rounded-xl border transition-all duration-200',
          `bg-gradient-to-r ${RARITY_BG[rarity]}`,
          RARITY_BORDER[rarity],
          selected && 'ring-2 ring-brand scale-[1.02]',
          exhausted && 'opacity-50',
          onClick && 'active:scale-95'
        )}
      >
        <div className="relative w-12 h-12 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden">
          {card.imageUrl ? (
            <Image
              src={card.imageUrl}
              alt={card.playerName}
              fill
              className="object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : card.isCustom ? (
            <div className="w-full h-full flex items-center justify-center bg-brand/10">
              <UserRound size={26} className="text-brand" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              {card.position === 'GK' ? '🧤' : card.position === 'DEF' ? '🛡️' : card.position === 'MID' ? '⚡' : '⚽'}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-800 text-base truncate uppercase">{card.playerName}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-300 uppercase font-semibold">{POSITION_LABELS[card.position]}</span>
            <span className="text-xs" style={{ color: cfg.color }}>• {cfg.label}</span>
          </div>
        </div>
        {exhausted && <Clock size={16} className="text-red-400 flex-shrink-0" />}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative card-shine rounded-2xl border overflow-hidden transition-all duration-200 w-full',
        `bg-gradient-to-b ${RARITY_BG[rarity]}`,
        RARITY_BORDER[rarity],
        rarity === 'LEGENDARY' && 'legendary-glow',
        selected && 'ring-2 ring-brand ring-offset-1 ring-offset-surface-0 scale-[1.03]',
        exhausted && 'grayscale opacity-60',
        onClick && 'active:scale-95 cursor-pointer'
      )}
    >
      {/* Rarity badge */}
      <div className="absolute top-2 right-2 z-10">
        <span
          className="text-[9px] font-display font-800 uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ color: cfg.color, background: `${cfg.glowColor}` }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Position badge */}
      <div className="absolute top-2 left-2 z-10">
        <span
          className="text-[10px] font-display font-700 px-1.5 py-0.5 rounded"
          style={{ background: POSITION_COLORS[card.position] + '33', color: POSITION_COLORS[card.position] }}
        >
          {card.position}
        </span>
      </div>

      {/* Card image area */}
      <div className="relative h-48 flex items-center justify-center bg-black/40 overflow-hidden">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.playerName}
            fill
            className="object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : card.isCustom ? (
          <div className="flex flex-col items-center justify-center gap-3 text-brand">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border border-brand/35 bg-brand/10">
              <UserRound size={54} />
            </div>
            <span className="text-xs font-display font-800 uppercase tracking-[0.18em] text-brand/80">
              Custom Player
            </span>
          </div>
        ) : (
          <div className="text-7xl select-none">
            {card.position === 'GK' ? '🧤' : card.position === 'DEF' ? '🛡️' : card.position === 'MID' ? '⚡' : '⚽'}
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
      </div>

      {/* Player name */}
      <div className="px-4 pb-2 pt-3">
        <p className="font-display font-900 text-2xl leading-tight uppercase tracking-wide truncate">
          {card.playerName}
        </p>
        <p className="text-sm text-gray-300 uppercase tracking-widest font-semibold">{card.club}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-1 mx-3 mb-3 mt-2">
        {(['speed', 'shot', 'dribbling', 'physical', 'defense'] as const).map((stat) => (
          <div key={stat} className="flex flex-col items-center bg-white/5 rounded-lg py-2">
            <span className="text-base font-display font-900" style={{ color: cfg.color }}>
              {card.stats[stat]}
            </span>
            <span className="text-[10px] text-gray-500 uppercase font-display font-700">{stat.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      {/* Energy bar */}
      <div className="mx-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Zap size={12} className={exhausted ? 'text-red-400' : 'text-brand'} />
            <span className="text-xs text-gray-400 font-display font-700 uppercase">Energy</span>
          </div>
          <span className={cn('text-xs font-display font-800', exhausted ? 'text-red-400' : 'text-brand')}>
            {exhausted ? (isOnCooldown ? formatTimeLeft(cooldownEndAt) : 'DRAINED') : `${energyPct}%`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', energyPct > 30 ? 'energy-bar' : 'energy-bar-low')}
            style={{ width: `${energyPct}%` }}
          />
        </div>
      </div>

      {/* Exhausted overlay */}
      {exhausted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
          <div className="text-center">
            <Clock size={20} className="text-red-400 mx-auto mb-1" />
            <p className="text-xs font-display font-700 text-red-400">
              {isOnCooldown ? formatTimeLeft(cooldownEndAt) : 'DRAINED'}
            </p>
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute inset-0 pointer-events-none rounded-2xl ring-2 ring-brand ring-inset" />
      )}
    </button>
  )
}
