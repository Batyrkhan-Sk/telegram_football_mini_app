'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Swords, Share2, Users, User, ChevronRight, AlertTriangle } from 'lucide-react'
import { useUserStore, useBattleStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { PlayerCard } from '@/components/cards/PlayerCard'
import { SectionHeader, LoadingSpinner, Badge } from '@/components/ui'
import { shareBattleToTelegram, hapticFeedback } from '@/lib/telegram'
import type { UserCard, BattleResult } from '@/types'

const MOCK_OPPONENTS = [
  { telegramId: '200000001', name: 'sultan_kz', level: 8, xp: 2100 },
  { telegramId: '200000002', name: 'kz_striker9', level: 7, xp: 1800 },
  { telegramId: '200000003', name: 'almaty_united', level: 4, xp: 980 },
  { telegramId: '200000005', name: 'steppe_eagle', level: 12, xp: 3200 },
]

export default function BattlePage() {
  const router = useRouter()
  const { user } = useUserStore()
  const { selectedCards, format, opponentId, selectCard, deselectCard, setFormat, setOpponent, clearSelection } = useBattleStore()

  const [phase, setPhase] = useState<'setup' | 'resolving' | 'result'>('setup')
  const [result, setResult] = useState<BattleResult | null>(null)
  const [error, setError] = useState('')

  const { data: cardsData } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: () => fetch(`/api/cards?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const availableCards = (cardsData?.data ?? []).filter((c) => !c.isExhausted && !c.isOnCooldown)
  const maxCards = format === 'ONE_V_ONE' ? 1 : 3
  const selectedOpponent = MOCK_OPPONENTS.find((o) => o.telegramId === opponentId) ?? MOCK_OPPONENTS[0]

  const { mutate: startBattle, isPending } = useMutation({
    mutationFn: () =>
      fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user?.telegramId,
          opponentTelegramId: selectedOpponent.telegramId,
          format,
          selectedUserCardIds: selectedCards.map((c) => c.id),
        }),
      }).then((r) => r.json()),
    onMutate: () => {
      setPhase('resolving')
      setError('')
    },
    onSuccess: (res) => {
      if (res.error) { setError(res.error); setPhase('setup'); return }
      hapticFeedback(res.data?.winnerId ? 'success' : 'warning')
      setResult(res.data)
      setPhase('result')
    },
    onError: () => {
      setError('Battle failed. Try again.')
      setPhase('setup')
    },
  })

  const { mutate: createChallenge } = useMutation({
    mutationFn: () =>
      fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user?.telegramId,
          format,
          selectedUserCardIds: selectedCards.map((card) => card.id),
        }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.data?.shareUrl) {
        shareBattleToTelegram(
          res.data.challengeId,
          res.data.shareUrl,
          '⚽ I challenge you to a FC Kairat card battle! Can you beat me?'
        )
      }
    },
  })

  if (phase === 'resolving') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          ⚽
        </motion.div>
        <div className="text-center">
          <p className="font-display font-900 text-2xl uppercase">Battle in progress…</p>
          <p className="text-gray-400 text-sm mt-1">Calculating result</p>
        </div>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const won = result.winnerId === user?.id
    const SUMMARIES: Record<string, { emoji: string; label: string }> = {
      GOAL_SCORED: { emoji: '⚽', label: 'GOAL!' },
      SAVE_MADE: { emoji: '🧤', label: 'SAVED!' },
      COUNTERATTACK_WIN: { emoji: '💨', label: 'COUNTER ATTACK!' },
      PENALTY_WIN: { emoji: '🎯', label: 'PENALTY WINNER!' },
      HEADER_WIN: { emoji: '🔛', label: 'HEADER WIN!' },
      FREEKICK_WIN: { emoji: '🌀', label: 'FREE KICK!' },
    }
    const summary = SUMMARIES[result.resultSummary] ?? { emoji: '⚽', label: 'MATCH OVER' }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="text-7xl mb-2">{summary.emoji}</div>
          <h1 className="font-display font-900 text-4xl uppercase text-brand">{summary.label}</h1>
          <p className={`font-display font-800 text-2xl uppercase mt-1 ${won ? 'text-green-400' : 'text-red-400'}`}>
            {result.isDraw ? 'DRAW' : won ? 'YOU WIN!' : 'YOU LOSE'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full max-w-sm"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center bg-surface-3 rounded-xl p-3">
              <p className="font-display font-900 text-2xl text-brand">{result.player1Power.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 uppercase">Your Power</p>
            </div>
            <div className="text-center bg-surface-3 rounded-xl p-3">
              <p className="font-display font-900 text-2xl text-gray-400">{result.player2Power.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 uppercase">Opp Power</p>
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <div className="bg-surface-3 rounded-xl px-4 py-2 text-center">
              <p className="font-display font-800 text-lg text-brand">+{result.xpGained}</p>
              <p className="text-[10px] text-gray-400">XP</p>
            </div>
            {result.coinsGained > 0 && (
              <div className="bg-surface-3 rounded-xl px-4 py-2 text-center">
                <p className="font-display font-800 text-lg text-yellow-300">+{result.coinsGained}</p>
                <p className="text-[10px] text-gray-400">Coins</p>
              </div>
            )}
          </div>
        </motion.div>

        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => { clearSelection(); setPhase('setup'); setResult(null) }}
            className="flex-1 bg-surface-3 border border-white/8 font-display font-700 uppercase py-3 rounded-xl"
          >
            Play Again
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-brand text-black font-display font-800 uppercase py-3 rounded-xl"
          >
            Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4">
        <SectionHeader title="Battle" subtitle="Select your cards and fight" />

        {/* Format selector */}
        <div className="flex gap-2 mb-4">
          {(['ONE_V_ONE', 'THREE_V_THREE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-display font-700 uppercase text-sm transition-all ${
                format === f ? 'bg-brand text-black' : 'bg-surface-3 text-gray-400 border border-white/8'
              }`}
            >
              {f === 'ONE_V_ONE' ? <User size={15} /> : <Users size={15} />}
              {f === 'ONE_V_ONE' ? '1v1' : '3v3'}
            </button>
          ))}
        </div>

        {/* Opponent selector */}
        <div className="mb-4">
          <p className="text-[11px] font-display uppercase text-gray-400 mb-2">Opponent</p>
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
            {MOCK_OPPONENTS.map((opp) => (
              <button
                key={opp.telegramId}
                onClick={() => setOpponent(opp.telegramId)}
                className={`flex-shrink-0 flex flex-col items-center bg-surface-3 rounded-xl p-2.5 min-w-[72px] transition-all ${
                  selectedOpponent.telegramId === opp.telegramId
                    ? 'border-2 border-brand'
                    : 'border border-white/8'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-surface-1 flex items-center justify-center text-xl mb-1">⚽</div>
                <p className="text-[10px] font-display font-700 truncate max-w-[64px]">{opp.name}</p>
                <p className="text-[9px] text-gray-500">Lv{opp.level}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Card selection */}
        <div className="mb-4">
          <p className="text-[11px] font-display uppercase text-gray-400 mb-2">
            Select Cards ({selectedCards.length}/{maxCards})
          </p>

          {availableCards.length === 0 ? (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
              <AlertTriangle size={16} className="text-red-400" />
              <div>
                <p className="text-sm font-display font-700 text-red-400">All cards exhausted</p>
                <p className="text-[10px] text-gray-400">Scan a SNICKERS QR to restore</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {availableCards.map((uc) => {
                const isSelected = selectedCards.some((c) => c.id === uc.id)
                return (
                  <div key={uc.id} onClick={() => isSelected ? deselectCard(uc.id) : selectCard(uc)}>
                    <PlayerCard userCard={uc} selected={isSelected} compact />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm font-display font-700 text-center mb-3">{error}</p>
        )}

        {/* Action buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => startBattle()}
            disabled={selectedCards.length === 0 || selectedCards.length < maxCards || isPending}
            className="w-full flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-base py-3.5 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            <Swords size={18} />
            {selectedCards.length < maxCards ? `Select ${maxCards - selectedCards.length} more card${maxCards - selectedCards.length > 1 ? 's' : ''}` : 'Battle!'}
          </button>

          <button
            onClick={() => createChallenge()}
            disabled={selectedCards.length < maxCards}
            className="w-full flex items-center justify-center gap-2 bg-surface-3 border border-white/8 font-display font-700 uppercase text-sm py-3 rounded-2xl"
          >
            <Share2 size={16} />
            Challenge a Friend via Telegram
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
