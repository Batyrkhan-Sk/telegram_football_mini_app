'use client'

import { useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, QrCode, Timer, Target, Zap } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner, Badge } from '@/components/ui'
import { hapticFeedback } from '@/lib/telegram'
import { formatTimeLeft, isOnCooldown } from '@/lib/utils'
import Link from 'next/link'
import { AR_MODE } from '@/config/game'

type Phase = 'idle' | 'camera' | 'playing' | 'finished'
type ShotResult = 'goal' | 'save' | null

const GK_ZONES = ['top-left', 'top-center', 'top-right', 'mid-left', 'mid-right', 'bottom-left', 'bottom-right']

function GoalNet({ onShoot }: { onShoot: (zone: string) => void }) {
  return (
    <div className="relative w-full aspect-[2/1] max-w-sm mx-auto">
      {/* Goal frame */}
      <div className="absolute inset-0 border-4 border-white/30 rounded-t-lg bg-gradient-to-b from-pitch-bg/60 to-transparent">
        {/* Goal net grid */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '16.66% 33.33%',
          }}
        />

        {/* Clickable zones */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0">
          {['tl','tc','tr','ml','mc','mr','bl','bc','br'].map((zone, i) => (
            <button
              key={zone}
              onClick={() => onShoot(zone)}
              className="relative opacity-0 hover:opacity-100 hover:bg-white/10 transition-all active:bg-white/20"
              aria-label={`Shoot ${zone}`}
            />
          ))}
        </div>
      </div>

      {/* Goalkeeper */}
      <motion.div
        className="absolute text-3xl"
        style={{ bottom: '5%' }}
        animate={{
          x: ['0%', '30%', '-30%', '15%', '-15%', '0%'],
          transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
        }}
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: '5%' }}
      >
        🧤
      </motion.div>

      {/* Ball */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-2xl">⚽</div>
    </div>
  )
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [goalsScored, setGoalsScored] = useState(0)
  const [shotsLeft, setShotsLeft] = useState(AR_MODE.SHOTS_PER_SESSION)
  const [lastShot, setLastShot] = useState<ShotResult>(null)
  const [shotHistory, setShotHistory] = useState<ShotResult[]>([])
  const [sessionResult, setSessionResult] = useState<{ success: boolean; xpGained: number; coinsGained: number } | null>(null)

  const { data: arStatus } = useQuery({
    queryKey: ['ar-status', user?.telegramId],
    queryFn: () => fetch(`/api/ar?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const { mutate: submitSession, isPending } = useMutation({
    mutationFn: (data: { goalsScored: number; totalShots: number }) =>
      fetch('/api/ar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user?.telegramId, ...data }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.data) {
        setSessionResult(res.data)
        hapticFeedback(res.data.success ? 'success' : 'warning')
        qc.invalidateQueries({ queryKey: ['ar-status'] })
      }
    },
  })

  const handleShoot = useCallback((zone: string) => {
    if (shotsLeft <= 0) return
    hapticFeedback('medium')

    // GK saves ~40% of shots — weighted towards center/bottom shots
    const isGoal = Math.random() > 0.40
    const result: ShotResult = isGoal ? 'goal' : 'save'

    setLastShot(result)
    setShotHistory((prev) => [...prev, result])
    if (isGoal) setGoalsScored((g) => g + 1)

    const newShotsLeft = shotsLeft - 1
    setShotsLeft(newShotsLeft)

    setTimeout(() => {
      setLastShot(null)
      if (newShotsLeft === 0) {
        const finalGoals = isGoal ? goalsScored + 1 : goalsScored
        setPhase('finished')
        submitSession({ goalsScored: finalGoals, totalShots: AR_MODE.SHOTS_PER_SESSION })
      }
    }, 900)
  }, [shotsLeft, goalsScored, submitSession])

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd

  // ── Idle / cooldown screen ─────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div className="flex flex-col min-h-screen pb-24">
        <div className="px-4 pt-4">
          <h1 className="font-display font-900 text-3xl uppercase mb-1">Penalty Mode</h1>
          <p className="text-gray-400 text-sm mb-6">Score 3+ goals to earn XP and coins</p>

          {/* Info cards */}
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

          {/* Big goal net preview */}
          <div className="pitch-bg rounded-3xl p-6 mb-6">
            <div className="relative w-full aspect-[2/1] max-w-xs mx-auto border-4 border-white/20 rounded-t-xl flex items-center justify-center">
              <div className="text-6xl">🧤</div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl">⚽</div>
            </div>
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
              onClick={() => setPhase('camera')}
              className="w-full flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl"
            >
              <Camera size={20} />
              Start Penalty Session
            </button>
          )}
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Camera / permission screen ─────────────────────────────────────────────

  if (phase === 'camera') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Camera size={64} className="text-brand mx-auto mb-3" />
          <h2 className="font-display font-900 text-2xl uppercase mb-2">Camera Mode</h2>
          <p className="text-gray-400 text-sm mb-1">
            Point your camera at a surface to activate the AR goal.
          </p>
          <p className="text-xs text-gray-600">
            (MVP: simulated AR — tap zones to shoot)
          </p>
        </motion.div>

        <div className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full text-left space-y-2">
          <p className="font-display font-700 text-sm uppercase text-gray-400">How to play:</p>
          <p className="text-sm text-gray-300">1. Tap zones in the goal to shoot</p>
          <p className="text-sm text-gray-300">2. The GK moves — time your shot</p>
          <p className="text-sm text-gray-300">3. Score 3+ out of 5 to win</p>
        </div>

        <button
          onClick={() => setPhase('playing')}
          className="w-full bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl"
        >
          Ready → Start
        </button>
      </div>
    )
  }

  // ── Playing screen ─────────────────────────────────────────────────────────

  if (phase === 'playing') {
    return (
      <div className="flex flex-col min-h-screen">
        {/* HUD */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: AR_MODE.SHOTS_PER_SESSION }).map((_, i) => {
              const shot = shotHistory[i]
              return (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 ${
                    shot === 'goal' ? 'border-green-400 bg-green-400/20' :
                    shot === 'save' ? 'border-red-400 bg-red-400/20' :
                    'border-white/20 bg-surface-3'
                  }`}
                >
                  {shot === 'goal' ? '⚽' : shot === 'save' ? '🧤' : ''}
                </div>
              )
            })}
          </div>
          <div className="text-right">
            <p className="font-display font-900 text-2xl text-brand">{goalsScored}</p>
            <p className="text-[10px] text-gray-400 uppercase">Goals</p>
          </div>
        </div>

        {/* Pitch */}
        <div className="flex-1 pitch-bg flex flex-col items-center justify-center px-4 gap-4">
          <AnimatePresence>
            {lastShot && (
              <motion.div
                key={lastShot}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="text-center mb-2"
              >
                <p className={`font-display font-900 text-4xl ${lastShot === 'goal' ? 'text-green-400' : 'text-red-400'}`}>
                  {lastShot === 'goal' ? '⚽ GOAL!' : '🧤 SAVED!'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <GoalNet onShoot={handleShoot} />

          <p className="text-gray-400 text-sm font-display uppercase">
            Tap a zone to shoot · {shotsLeft} shot{shotsLeft !== 1 ? 's' : ''} left
          </p>
        </div>
      </div>
    )
  }

  // ── Finished screen ────────────────────────────────────────────────────────

  if (phase === 'finished') {
    const totalShots = AR_MODE.SHOTS_PER_SESSION
    const goals = shotHistory.filter((s) => s === 'goal').length
    const success = goals >= AR_MODE.GOALS_TO_WIN

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="text-7xl mb-2">{success ? '🏆' : '😤'}</div>
          <h1 className={`font-display font-900 text-4xl uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {success ? 'Outstanding!' : 'So Close!'}
          </h1>
          <p className="text-gray-400 text-lg mt-1">{goals} / {totalShots} goals scored</p>
        </motion.div>

        {/* Shot breakdown */}
        <div className="flex gap-2 justify-center">
          {shotHistory.map((s, i) => (
            <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 ${s === 'goal' ? 'border-green-400 bg-green-400/20' : 'border-red-400 bg-red-400/20'}`}>
              {s === 'goal' ? '⚽' : '🧤'}
            </div>
          ))}
        </div>

        {sessionResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-surface-2 border border-white/8 rounded-2xl p-4 w-full max-w-sm"
          >
            <div className="flex gap-3 justify-center">
              <div className="bg-surface-3 rounded-xl px-5 py-2 text-center">
                <p className="font-display font-900 text-xl text-brand">+{sessionResult.xpGained}</p>
                <p className="text-[10px] text-gray-400">XP</p>
              </div>
              {sessionResult.coinsGained > 0 && (
                <div className="bg-surface-3 rounded-xl px-5 py-2 text-center">
                  <p className="font-display font-900 text-xl text-yellow-300">+{sessionResult.coinsGained}</p>
                  <p className="text-[10px] text-gray-400">Coins</p>
                </div>
              )}
            </div>
            {!success && (
              <p className="text-xs text-gray-500 mt-3">Next session available in {AR_MODE.SESSION_COOLDOWN_HOURS}h</p>
            )}
          </motion.div>
        )}

        <div className="flex gap-3 w-full max-w-sm">
          {!success && (
            <Link href="/scan" className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/20 border border-red-600/30 text-red-400 font-display font-700 uppercase py-3 rounded-xl text-sm">
              <QrCode size={14} /> Skip Cooldown
            </Link>
          )}
          <button
            onClick={() => { setPhase('idle'); setGoalsScored(0); setShotsLeft(AR_MODE.SHOTS_PER_SESSION); setShotHistory([]); setSessionResult(null) }}
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
