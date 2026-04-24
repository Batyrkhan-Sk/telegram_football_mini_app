'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Trophy, Crown, Medal, Zap } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { Skeleton, SectionHeader } from '@/components/ui'
import { formatXP, getAvatarUrl, getRankLabel } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types'

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={18} className="text-yellow-400" />
  if (rank === 2) return <Medal size={18} className="text-gray-300" />
  if (rank === 3) return <Medal size={18} className="text-amber-600" />
  return <span className="font-display font-800 text-sm text-gray-500 w-[18px] text-center">{rank}</span>
}

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const displayName = entry.firstName ?? entry.username ?? 'Player'
  const top3 = entry.rank <= 3
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(entry.rank * 0.04, 0.5) }}
      className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${
        isCurrentUser
          ? 'bg-brand/15 border border-brand/30'
          : top3
          ? 'bg-surface-2 border border-white/8'
          : 'bg-surface-2 border border-transparent'
      }`}
    >
      <div className="w-7 flex items-center justify-center flex-shrink-0">
        <RankIcon rank={entry.rank} />
      </div>

      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 border-2 ${
        top3 ? 'border-brand/40' : 'border-white/10'
      } bg-surface-3`}>
        ⚽
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`font-display font-800 text-sm truncate ${isCurrentUser ? 'text-brand' : ''}`}>
            {displayName}
            {isCurrentUser && <span className="text-brand ml-1">← You</span>}
          </p>
        </div>
        <p className="text-[10px] text-gray-500">
          Lv{entry.level} · {entry.battlesWon} wins · {getRankLabel(entry.level)}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1 justify-end">
          <Zap size={10} className="text-brand" />
          <p className="font-display font-800 text-sm text-brand">{formatXP(entry.xp)}</p>
        </div>
        <p className="text-[9px] text-gray-500">XP</p>
      </div>
    </motion.div>
  )
}

export default function LeaderboardPage() {
  const { user } = useUserStore()

  const { data, isLoading } = useQuery<{ data: LeaderboardEntry[] }>({
    queryKey: ['leaderboard'],
    queryFn: () => fetch('/api/leaderboard').then((r) => r.json()),
    refetchInterval: 60_000,
  })

  const entries = data?.data ?? []
  const currentUserEntry = entries.find((e) => e.userId === user?.id)
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4">
        <SectionHeader title="Leaderboard" subtitle="Global XP rankings" />

        {/* Podium */}
        {!isLoading && top3.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-6 pt-2">
            {/* 2nd */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-surface-3 border-2 border-gray-400 flex items-center justify-center text-xl">⚽</div>
              <p className="font-display font-800 text-xs truncate max-w-[60px] text-center">{top3[1]?.firstName ?? top3[1]?.username}</p>
              <div className="w-16 h-12 bg-gray-400/20 border border-gray-400/30 rounded-t-lg flex items-end justify-center pb-1">
                <span className="font-display font-900 text-lg text-gray-300">2</span>
              </div>
            </motion.div>

            {/* 1st */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex flex-col items-center gap-1"
            >
              <Crown size={20} className="text-yellow-400" />
              <div className="w-14 h-14 rounded-full bg-surface-3 border-2 border-yellow-400 flex items-center justify-center text-2xl legendary-glow">⚽</div>
              <p className="font-display font-800 text-xs truncate max-w-[64px] text-center text-brand">{top3[0]?.firstName ?? top3[0]?.username}</p>
              <div className="w-16 h-16 bg-brand/20 border border-brand/40 rounded-t-lg flex items-end justify-center pb-1">
                <span className="font-display font-900 text-xl text-brand">1</span>
              </div>
            </motion.div>

            {/* 3rd */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-surface-3 border-2 border-amber-700 flex items-center justify-center text-xl">⚽</div>
              <p className="font-display font-800 text-xs truncate max-w-[60px] text-center">{top3[2]?.firstName ?? top3[2]?.username}</p>
              <div className="w-16 h-10 bg-amber-700/20 border border-amber-700/30 rounded-t-lg flex items-end justify-center pb-1">
                <span className="font-display font-900 text-lg text-amber-700">3</span>
              </div>
            </motion.div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <div className="space-y-1.5">
            {rest.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                isCurrentUser={entry.userId === user?.id}
              />
            ))}
          </div>
        )}

        {/* Current user if not in top */}
        {currentUserEntry && currentUserEntry.rank > entries.length && (
          <div className="mt-4 pt-4 border-t border-white/8">
            <p className="text-[10px] font-display uppercase text-gray-500 mb-2">Your Position</p>
            <LeaderboardRow entry={currentUserEntry} isCurrentUser />
          </div>
        )}

        {entries.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Trophy size={40} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 font-display uppercase">No rankings yet</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
