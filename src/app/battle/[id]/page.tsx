'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Share2 } from 'lucide-react'
import { useUserStore } from '@/store'
import { LoadingSpinner } from '@/components/ui'
import { shareToTelegram } from '@/lib/telegram'
import { formatXP } from '@/lib/utils'

export default function BattleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUserStore()

  // Try challenge lookup first (deep link flow)
  const { data: challengeData, isLoading } = useQuery({
    queryKey: ['challenge', id],
    queryFn: () => fetch(`/api/challenge?id=${id}`).then((r) => r.json()),
    enabled: !!id,
  })

  const challenge = challengeData?.data

  if (isLoading) {
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

  const isOwn = challenge.senderId === user?.id
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/battle/${id}`

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
          <button
            onClick={() => router.push('/battle')}
            className="w-full bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl"
          >
            Accept Challenge →
          </button>
        )}

        {isOwn && (
          <button
            onClick={() => shareToTelegram(shareUrl, '⚽ I challenge you to a FC Kairat card battle!')}
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
