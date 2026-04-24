'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Filter, QrCode } from 'lucide-react'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { PlayerCard } from '@/components/cards/PlayerCard'
import { Skeleton, SectionHeader } from '@/components/ui'
import type { UserCard } from '@/types'

const FILTERS = ['All', 'FWD', 'MID', 'DEF', 'GK', 'Exhausted']

export default function CardsPage() {
  const { user } = useUserStore()
  const [filter, setFilter] = useState('All')

  const { data, isLoading } = useQuery<{ data: UserCard[] }>({
    queryKey: ['cards', user?.telegramId],
    queryFn: () => fetch(`/api/cards?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
    refetchInterval: 30_000,
  })

  const cards = data?.data ?? []

  const filtered = cards.filter((c) => {
    if (filter === 'All') return true
    if (filter === 'Exhausted') return c.isExhausted || c.isOnCooldown
    return c.card.position === filter
  })

  const exhaustedCount = cards.filter((c) => c.isExhausted || c.isOnCooldown).length

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4">
        <SectionHeader
          title="My Cards"
          subtitle={`${cards.length} collected`}
          action={
            exhaustedCount > 0 ? (
              <Link
                href="/scan"
                className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-display font-700 uppercase px-2.5 py-1.5 rounded-lg"
              >
                <QrCode size={12} />
                Restore {exhaustedCount}
              </Link>
            ) : null
          }
        />

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-display font-700 uppercase tracking-wide transition-all ${
                filter === f
                  ? 'bg-brand text-black'
                  : 'bg-surface-3 text-gray-400 border border-white/8'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-3">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🃏</div>
            <p className="font-display font-700 text-lg uppercase text-gray-400">No cards</p>
            <p className="text-sm text-gray-500 mt-1">
              {filter !== 'All' ? 'Try a different filter' : 'Battle to earn more cards'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((uc, i) => (
              <motion.div
                key={uc.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/cards/${uc.id}`}>
                  <PlayerCard userCard={uc} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
