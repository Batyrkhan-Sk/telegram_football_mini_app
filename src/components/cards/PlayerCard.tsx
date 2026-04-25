'use client'

import { useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import * as lorelei from '@dicebear/lorelei'
import { cn } from '@/lib/utils'
import { RARITY_CONFIG, POSITION_LABELS } from '@/config/game'
import type { Character, UserCard } from '@/types'
import { Zap, Clock } from 'lucide-react'
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

function draftToAvataaarsOptions(character: Character, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f8d25c',
    tone2: 'ae5d29',
    tone3: '694d3d',
    tone4: '3b1f1f',
  }
  const topMap: Record<string, string> = {
    style1: 'shortHair',
    style2: 'frizzle',
    style3: 'wavyBob',
    style4: 'bigHair',
  }
  const eyesMap: Record<string, string> = {
    face1: 'squint',
    face2: 'happy',
    face3: 'wink',
    face4: 'default',
  }
  const eyebrowsMap: Record<string, string> = {
    face1: 'angryNatural',
    face2: 'defaultNatural',
    face3: 'raisedExcited',
    face4: 'flatNatural',
  }
  const jerseyColorMap: Record<string, string> = {
    jersey1: 'f5c518',
    jersey2: 'eeeeee',
    jersey3: '222222',
    jersey4: 'c8102e',
  }

  return {
    seed,
    skinColor: [skinMap[character.skinTone] ?? 'ae5d29'],
    top: [topMap[character.hairstyle] ?? 'shortHair'],
    eyes: [eyesMap[character.faceType] ?? 'default'],
    eyebrows: [eyebrowsMap[character.faceType] ?? 'defaultNatural'],
    clothesColor: [jerseyColorMap[character.jerseyStyle] ?? 'f5c518'],
    accessories: ['prescription02'],
    facialHair: [],
    backgroundColor: ['transparent'],
  }
}

function draftToLoreleiOptions(character: Character, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f9c9b6',
    tone2: 'd08b5b',
    tone3: 'ae5d29',
    tone4: '694d3d',
  }
  const hairColorMap: Record<string, string> = {
    style1: 'f5c518',
    style2: 'c8102e',
    style3: '38bdf8',
    style4: '7c3aed',
  }

  return {
    seed,
    skinColor: [skinMap[character.skinTone] ?? 'd08b5b'],
    hairColor: [hairColorMap[character.hairstyle] ?? 'f5c518'],
    backgroundColor: ['transparent'],
  }
}

function SavedCharacterPortrait({
  character,
  compact = false,
}: {
  character: Character
  compact?: boolean
}) {
  const dataUri = useMemo(() => {
    const seed = `${character.nickname || 'kairat'}-${character.hairstyle}-${character.faceType}-${character.skinTone}-${character.jerseyStyle}`
    const avatar = character.animeMode
      ? createAvatar(lorelei, draftToLoreleiOptions(character, seed) as never)
      : createAvatar(avataaars, draftToAvataaarsOptions(character, seed) as never)

    return avatar.toDataUri()
  }, [character])

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-brand/10 via-black/10 to-black/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUri}
        alt={`${character.nickname} avatar`}
        className={compact ? 'h-11 w-11 object-contain' : 'h-full w-full object-contain'}
      />
    </div>
  )
}

export function PlayerCard({ userCard, selected, onClick, compact }: CardProps) {
  const { card, energy, maxEnergy, cooldownEndAt, isExhausted, isOnCooldown } = userCard
  const rarity = card.rarity
  const cfg = RARITY_CONFIG[rarity]
  const energyPct = Math.round((energy / maxEnergy) * 100)
  const exhausted = isExhausted || isOnCooldown
  const cardImage = card.imageUrl

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
          {cardImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardImage}
              alt={card.playerName}
              className="h-full w-full object-cover"
            />
          ) : card.isCustom && card.character ? (
            <SavedCharacterPortrait compact character={card.character} />
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
        {cardImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardImage}
            alt={card.playerName}
            className="h-full w-full object-cover"
          />
        ) : card.isCustom && card.character ? (
          <SavedCharacterPortrait character={card.character} />
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
