'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Timer, Target, Zap, Trophy, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/ui'
import { hapticFeedback } from '@/lib/telegram'
import { formatTimeLeft, isOnCooldown } from '@/lib/utils'
import { AR_MODE, ECONOMY } from '@/config/game'

type Phase = 'idle' | 'ar' | 'result'

interface ArResult {
  goalsScored: number
  totalShots: number
  success: boolean
  xpGained: number
  coinsGained: number
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ArResult | null>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'AR_SESSION_COMPLETE') {
        const { goalsScored, totalShots } = event.data
        handleSessionComplete(goalsScored, totalShots)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [user?.telegramId])

  const { data: arStatus } = useQuery({
    queryKey: ['ar-status', user?.telegramId],
    queryFn: () => fetch(`/api/ar?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const { mutate: submitSession } = useMutation({
    mutationFn: (data: { goalsScored: number; totalShots: number }) =>
      fetch('/api/ar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user?.telegramId, ...data }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.data) {
        setResult(res.data)
        setPhase('result')
        hapticFeedback(res.data.success ? 'success' : 'warning')
        qc.invalidateQueries({ queryKey: ['ar-status'] })
      }
    },
  })

  const handleSessionComplete = (goalsScored: number, totalShots: number) => {
    submitSession({ goalsScored, totalShots })
  }

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd

  if (phase === 'idle') {
    return (
      <div className="flex flex-col min-h-screen pb-24">
        <div className="px-4 pt-4">
          <h1 className="font-display font-900 text-3xl uppercase mb-1">AR Penalty</h1>
          <p className="text-gray-400 text-sm mb-6">
            Point your camera at a SNICKERS bar to place a goal in AR
          </p>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { icon: Target, label: 'Shots', value: '5' },
              { icon: Zap, label: 'Goals needed', value: '3+' },
              { icon: Timer, label: 'Cooldown', value: `${AR_MODE.SESSION_COOLDOWN_HOURS}h` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-surface-2 border border-white/6 rounded-xl p-3 text-center">
                <Icon size={16} className="text-brand mx-auto mb-1" />
                <p className="font-display font-900 text-xl text-brand">{value}</p>
                <p className="text-[9px] text-gray-500 uppercase">{label}</p>
              </div>
            ))}
          </div>

          <div className="bg-surface-2 border border-white/6 rounded-2xl p-4 mb-6 space-y-3">
            <p className="font-display font-800 text-sm uppercase text-gray-300">How to play</p>
            {[
              { n: '1', text: 'Point camera at any SNICKERS bar or wrapper' },
              { n: '2', text: 'A football goal appears on top of the bar in AR' },
              { n: '3', text: 'Tap the goal zones to shoot — 5 attempts total' },
              { n: '4', text: 'Score 3+ goals to earn XP and coins' },
            ].map(({ n, text }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand/20 flex-shrink-0 flex items-center justify-center">
                  <span className="text-[10px] font-display font-900 text-brand">{n}</span>
                </div>
                <p className="text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>

          {onCooldown ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                <Timer size={20} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="font-display font-800 text-sm uppercase text-red-400">Mode on Cooldown</p>
                  <p className="text-xs text-gray-400">Available in {formatTimeLeft(cooldownEnd)}</p>
                </div>
              </div>
              <Link
                href="/scan"
                className="flex items-center justify-center gap-2 w-full bg-red-600 text-white font-display font-800 uppercase py-3.5 rounded-2xl"
              >
                <QrCode size={18} />
                Scan SNICKERS to Bypass
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setPhase('ar')}
              className="w-full flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl active:scale-95 transition-transform"
            >
              <Target size={20} />
              Start AR Session
            </button>
          )}
        </div>
        <BottomNav />
      </div>
    )
  }


  if (phase === 'ar') {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <iframe
          src="/ar-scene.html"
          className="w-full h-full border-0"
          allow="camera; microphone"
          title="AR Penalty Mode"
        />
        <button
          onClick={() => setPhase('idle')}
          className="absolute top-4 right-4 z-50 bg-black/70 text-white font-display font-800 uppercase text-xs px-3 py-2 rounded-xl border border-white/20"
        >
          ✕ Exit
        </button>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const success = result.goalsScored >= AR_MODE.GOALS_TO_WIN
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="text-7xl mb-2">{success ? '🏆' : '😤'}</div>
          <h1 className={`font-display font-900 text-4xl uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {success ? 'Outstanding!' : 'So Close!'}
          </h1>
          <p className="text-gray-400 text-lg mt-1">{result.goalsScored} / {result.totalShots} goals scored</p>
        </motion.div>

        <div className="flex gap-2 justify-center">
          {Array.from({ length: result.totalShots }).map((_, i) => (
            <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 ${i < result.goalsScored ? 'border-green-400 bg-green-400/20' : 'border-red-400 bg-red-400/20'}`}>
              {i < result.goalsScored ? '⚽' : '🧤'}
            </div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full max-w-sm">
          <div className="flex gap-3 justify-center">
            <div className="bg-surface-3 rounded-xl px-5 py-2 text-center">
              <p className="font-display font-900 text-xl text-brand">+{result.xpGained}</p>
              <p className="text-[10px] text-gray-400">XP</p>
            </div>
            {result.coinsGained > 0 && (
              <div className="bg-surface-3 rounded-xl px-5 py-2 text-center">
                <p className="font-display font-900 text-xl text-yellow-300">+{result.coinsGained}</p>
                <p className="text-[10px] text-gray-400">Coins</p>
              </div>
            )}
          </div>
          {!success && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              Next session in {AR_MODE.SESSION_COOLDOWN_HOURS}h
            </p>
          )}
        </motion.div>

        <div className="flex gap-3 w-full max-w-sm">
          {!success && (
            <Link href="/scan" className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/20 border border-red-600/30 text-red-400 font-display font-700 uppercase py-3 rounded-xl text-sm">
              <QrCode size={14} /> Skip Cooldown
            </Link>
          )}
          <button
            onClick={() => { setPhase('idle'); setResult(null) }}
            className="flex-1 bg-brand text-black font-display font-800 uppercase py-3 rounded-xl"
          >
            {success ? 'Play Again' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  return null
}