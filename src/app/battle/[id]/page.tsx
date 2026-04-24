'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Share2, Swords } from 'lucide-react'
import { useUserStore } from '@/store'
import { LoadingSpinner } from '@/components/ui'
import { PlayerCard } from '@/components/cards/PlayerCard'
import { shareToTelegram } from '@/lib/telegram'
import { formatXP } from '@/lib/utils'
import type { BattleResult, Challenge, UserCard } from '@/types'

export default function BattleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isLoading: isUserLoading } = useUserStore()
  const [selectedCards, setSelectedCards] = useState<UserCard[]>([])
  const [result, setResult] = useState<BattleResult | null>(null)
  const [error, setError] = useState('')

  const { data: challengeData, isLoading } = useQuery<{ data?: Challenge; error?: string }>({
    queryKey: ['challenge', id],
    queryFn: () => fetch(`/api/challenge?id=${id}`).then((r) => r.json()),
    enabled: !!id,
  })

  const challenge = challengeData?.data
  const isOwn = challenge?.senderId === user?.id
  const maxCards = challenge?.format === 'THREE_V_THREE' ? 3 : 1

  const { data: cardsData, isLoading: isCardsLoading, isFetching: isCardsFetching, error: cardsError } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: async () => {
      const response = await fetch(`/api/cards?telegramId=${user?.telegramId}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Failed to load cards')
      return payload
    },
    enabled: !isUserLoading && !!user?.telegramId && !!challenge && !isOwn && challenge.status === 'PENDING',
  })

  const availableCards = (cardsData?.data ?? []).filter((card) => !card.isExhausted && !card.isOnCooldown)
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/battle/${id}`

  const toggleCard = (card: UserCard) => {
    setSelectedCards((current) => {
      if (current.some((selected) => selected.id === card.id)) {
        return current.filter((selected) => selected.id !== card.id)
      }
      if (current.length >= maxCards) return current
      return [...current, card]
    })
  }

  const { mutate: acceptChallenge, isPending: isAccepting } = useMutation({
    mutationFn: () =>
      fetch(`/api/challenge?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user?.telegramId,
          selectedUserCardIds: selectedCards.map((card) => card.id),
        }),
      }).then((r) => r.json()),
    onMutate: () => setError(''),
    onSuccess: (res) => {
      if (res.error) {
        setError(res.error)
        return
      }
      setResult(res.data)
    },
    onError: () => setError('Failed to accept challenge. Try again.'),
  })

  if (isLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <div className="text-5xl">⚔️</div>
        <h1 className="font-display font-900 text-2xl uppercase">Challenge Not Found</h1>
        <p className="text-gray-400 text-sm">This challenge may have expired or been completed.</p>
        <button onClick={() => router.push('/battle')} className="bg-brand text-black font-display font-800 uppercase px-6 py-3 rounded-xl">
          Create New Battle
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4 text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="font-display font-900 text-2xl uppercase">Open In Telegram</h1>
        <p className="text-gray-400 text-sm">Join this challenge from the Telegram mini app so we can load your starter cards.</p>
      </div>
    )
  }

  if (result) {
    const won = result.winnerId === user?.id

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6 text-center">
        <div>
          <div className="text-7xl mb-2">⚽</div>
          <h1 className="font-display font-900 text-4xl uppercase text-brand">Match Over</h1>
          <p className={`font-display font-800 text-2xl uppercase mt-1 ${won ? 'text-green-400' : 'text-red-400'}`}>
            {result.isDraw ? 'Draw' : won ? 'You Win!' : 'You Lose'}
          </p>
        </div>

        <div className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center bg-surface-3 rounded-xl p-3">
              <p className="font-display font-900 text-2xl text-gray-400">{result.player1Power.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 uppercase">Challenger</p>
            </div>
            <div className="text-center bg-surface-3 rounded-xl p-3">
              <p className="font-display font-900 text-2xl text-brand">{result.player2Power.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 uppercase">Your Power</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            XP gained: +{won || result.isDraw ? result.xpGained : Math.floor(result.xpGained / 2)}
          </p>
        </div>

        <button
          onClick={() => router.push('/')}
          className="w-full bg-brand text-black font-display font-800 uppercase py-3 rounded-xl"
        >
          Home
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-8 px-4">
      <div className="flex items-center gap-3 pt-4 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl bg-surface-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-800 text-xl uppercase">Challenge</h1>
      </div>

      <div className="flex flex-col items-center text-center gap-6">
        <div className="text-7xl">⚔️</div>

        <div>
          <p className="text-gray-400 text-sm mb-1">
            {isOwn ? 'You challenged' : `${challenge.sender?.firstName ?? challenge.sender?.username} challenges you!`}
          </p>
          <h2 className="font-display font-900 text-3xl uppercase text-brand">
            {challenge.format === 'ONE_V_ONE' ? '1v1 Duel' : '3v3 Team Battle'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Expires: {new Date(challenge.expiresAt).toLocaleString()}
          </p>
        </div>

        <div className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full">
          <p className="text-[10px] font-display uppercase text-gray-400 mb-2">Challenger</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center text-2xl">⚽</div>
            <div className="text-left">
              <p className="font-display font-800 text-lg">{challenge.sender?.firstName ?? challenge.sender?.username}</p>
              <p className="text-xs text-gray-400">@{challenge.sender?.username} · Lv{challenge.sender?.profile?.level}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-display font-800 text-brand">{formatXP(challenge.sender?.profile?.xp ?? 0)}</p>
              <p className="text-[10px] text-gray-400">XP</p>
            </div>
          </div>
        </div>

        {challenge.status === 'PENDING' && !isOwn && (
          <div className="w-full space-y-4">
            <div className="text-left">
              <p className="text-[11px] font-display uppercase text-gray-400 mb-2">
                Select Cards ({selectedCards.length}/{maxCards})
              </p>

              {isCardsLoading || isCardsFetching ? (
                <div className="flex items-center gap-3 bg-surface-2 border border-white/8 rounded-xl px-3 py-3">
                  <LoadingSpinner size={16} />
                  <p className="text-sm font-display font-700 text-gray-300">Loading your starter cards...</p>
                </div>
              ) : cardsError ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <div>
                    <p className="text-sm font-display font-700 text-red-400">Could not load cards</p>
                    <p className="text-[10px] text-gray-400">Close and reopen the challenge from Telegram</p>
                  </div>
                </div>
              ) : availableCards.length === 0 ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <div>
                    <p className="text-sm font-display font-700 text-red-400">No available cards</p>
                    <p className="text-[10px] text-gray-400">Open cards or scan a QR to restore energy</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableCards.map((card) => {
                    const selected = selectedCards.some((selectedCard) => selectedCard.id === card.id)
                    return (
                      <div key={card.id} onClick={() => toggleCard(card)}>
                        <PlayerCard userCard={card} selected={selected} compact />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm font-display font-700 text-center">{error}</p>}

            <button
              onClick={() => acceptChallenge()}
              disabled={selectedCards.length !== maxCards || isAccepting}
              className="w-full flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAccepting ? <LoadingSpinner size={18} /> : <Swords size={18} />}
              {selectedCards.length < maxCards ? `Select ${maxCards - selectedCards.length} card${maxCards - selectedCards.length > 1 ? 's' : ''}` : 'Accept Challenge'}
            </button>
          </div>
        )}

        {isOwn && (
          <button
            onClick={() => shareToTelegram(shareUrl, 'I challenge you to a FC Kairat card battle!')}
            className="w-full flex items-center justify-center gap-2 bg-surface-3 border border-white/8 font-display font-700 uppercase py-3 rounded-2xl"
          >
            <Share2 size={16} />
            Share Challenge Link
          </button>
        )}

        <p className="text-[10px] text-gray-600 font-display uppercase">
          Status: {challenge.status}
        </p>
      </div>
    </div>
  )
}
