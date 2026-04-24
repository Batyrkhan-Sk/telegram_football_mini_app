'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, QrCode, Target, Timer, Zap } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/ui'
import { hapticFeedback } from '@/lib/telegram'
import { formatTimeLeft } from '@/lib/utils'
import { AR_MODE } from '@/config/game'

type Phase = 'idle' | 'camera' | 'playing' | 'finished'
type ShotResult = 'goal' | 'save' | null

function GoalNet({ onShoot }: { onShoot: (zone: string) => void }) {
  return (
    <div className="relative w-full aspect-[2/1] max-w-sm mx-auto">
      <div className="absolute inset-0 border-4 border-white/30 rounded-t-lg bg-gradient-to-b from-pitch-bg/60 to-transparent">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '16.66% 33.33%',
          }}
        />

        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0">
          {['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].map((zone) => (
            <button
              key={zone}
              onClick={() => onShoot(zone)}
              className="relative opacity-0 transition-all hover:opacity-100 hover:bg-white/10 active:bg-white/20"
              aria-label={`Shoot ${zone}`}
            />
          ))}
        </div>
      </div>

      <motion.div
        className="absolute text-3xl"
        animate={{
          x: ['0%', '30%', '-30%', '15%', '-15%', '0%'],
          transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: '5%' }}
      >
        GK
      </motion.div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-2xl">o</div>
    </div>
  )
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [goalsScored, setGoalsScored] = useState(0)
  const [shotsLeft, setShotsLeft] = useState<number>(AR_MODE.SHOTS_PER_SESSION)
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

    const centerPenalty = zone === 'mc' || zone === 'bc' ? 0.18 : 0
    const edgeBonus = zone.includes('l') || zone.includes('r') ? 0.12 : 0
    const isGoal = Math.random() + edgeBonus - centerPenalty > 0.4
    const result: ShotResult = isGoal ? 'goal' : 'save'

    setLastShot(result)
    setShotHistory((prev) => [...prev, result])
    if (isGoal) setGoalsScored((g) => g + 1)

    const newShotsLeft = shotsLeft - 1
    setShotsLeft(newShotsLeft)

    window.setTimeout(() => {
      setLastShot(null)
      if (newShotsLeft === 0) {
        const finalGoals = isGoal ? goalsScored + 1 : goalsScored
        setPhase('finished')
        submitSession({ goalsScored: finalGoals, totalShots: AR_MODE.SHOTS_PER_SESSION })
      }
    }, 900)
  }, [goalsScored, shotsLeft, submitSession])

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd

  if (phase === 'idle') {
    return (
      <div className="flex min-h-screen flex-col pb-24">
        <div className="px-4 pt-4">
          <h1 className="mb-1 font-display text-3xl font-900 uppercase">Penalty Mode</h1>
          <p className="mb-6 text-sm text-gray-400">Score 3+ goals to earn XP and coins</p>

          <div className="mb-6 grid grid-cols-3 gap-2">
            {[
              { icon: Target, label: 'Shots', value: String(AR_MODE.SHOTS_PER_SESSION) },
              { icon: Zap, label: 'Goals needed', value: `${AR_MODE.GOALS_TO_WIN}+` },
              { icon: Timer, label: 'Cooldown', value: `${AR_MODE.SESSION_COOLDOWN_HOURS}h` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-surface-2 p-3 text-center">
                <Icon size={16} className="mx-auto mb-1 text-brand" />
                <p className="font-display text-xl font-900 text-brand">{value}</p>
                <p className="text-[9px] uppercase text-gray-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="pitch-bg mb-6 rounded-3xl p-6">
            <div className="relative mx-auto flex aspect-[2/1] w-full max-w-xs items-center justify-center rounded-t-xl border-4 border-white/20">
              <div className="text-4xl">GK</div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl">o</div>
            </div>
          </div>

          {onCooldown ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <Timer size={20} className="shrink-0 text-red-400" />
                <div>
                  <p className="font-display text-sm font-800 uppercase text-red-400">Mode on Cooldown</p>
                  <p className="text-xs text-gray-400">Available in {formatTimeLeft(cooldownEnd)}</p>
                </div>
              </div>
              <Link href="/scan" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-display font-800 uppercase text-white">
                <QrCode size={18} />
                Scan SNICKERS to Bypass
              </Link>
            </div>
          ) : (
            <button
              onClick={() => setPhase('camera')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-800 uppercase text-black"
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

  if (phase === 'camera') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Camera size={64} className="mx-auto mb-3 text-brand" />
          <h2 className="mb-2 font-display text-2xl font-900 uppercase">Camera Mode</h2>
          <p className="mb-1 text-sm text-gray-400">Point your camera at a surface to activate the AR goal.</p>
          <p className="text-xs text-gray-600">(MVP: simulated AR - tap zones to shoot)</p>
        </motion.div>

        <div className="w-full space-y-2 rounded-2xl border border-white/8 bg-surface-2 p-4 text-left">
          <p className="font-display text-sm font-700 uppercase text-gray-400">How to play:</p>
          <p className="text-sm text-gray-300">1. Tap zones in the goal to shoot</p>
          <p className="text-sm text-gray-300">2. The GK moves - time your shot</p>
          <p className="text-sm text-gray-300">3. Score 3+ out of 5 to win</p>
        </div>

        <button
          onClick={() => setPhase('playing')}
          className="w-full rounded-2xl bg-brand py-4 font-display text-lg font-800 uppercase text-black"
        >
          Ready - Start
        </button>
      </div>
    )
  }

  if (phase === 'playing') {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: AR_MODE.SHOTS_PER_SESSION }).map((_, i) => {
              const shot = shotHistory[i]
              return (
                <div
                  key={i}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm ${
                    shot === 'goal' ? 'border-green-400 bg-green-400/20' :
                    shot === 'save' ? 'border-red-400 bg-red-400/20' :
                    'border-white/20 bg-surface-3'
                  }`}
                >
                  {shot === 'goal' ? 'G' : shot === 'save' ? 'S' : ''}
                </div>
              )
            })}
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-900 text-brand">{goalsScored}</p>
            <p className="text-[10px] uppercase text-gray-400">Goals</p>
          </div>
        </div>

        <div className="pitch-bg flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <AnimatePresence>
            {lastShot && (
              <motion.div
                key={lastShot}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="mb-2 text-center"
              >
                <p className={`font-display text-4xl font-900 ${lastShot === 'goal' ? 'text-green-400' : 'text-red-400'}`}>
                  {lastShot === 'goal' ? 'GOAL!' : 'SAVED!'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <GoalNet onShoot={handleShoot} />

          <p className="font-display text-sm uppercase text-gray-400">
            Tap a zone to shoot - {shotsLeft} shot{shotsLeft !== 1 ? 's' : ''} left
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'finished') {
    const totalShots = AR_MODE.SHOTS_PER_SESSION
    const goals = shotHistory.filter((s) => s === 'goal').length
    const success = goals >= AR_MODE.GOALS_TO_WIN

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="mb-2 text-5xl">{success ? 'WIN' : 'MISS'}</div>
          <h1 className={`font-display text-4xl font-900 uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {success ? 'Outstanding!' : 'So Close!'}
          </h1>
          <p className="mt-1 text-lg text-gray-400">{goals} / {totalShots} goals scored</p>
        </motion.div>

        <div className="flex justify-center gap-2">
          {shotHistory.map((s, i) => (
            <div key={i} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-xl ${s === 'goal' ? 'border-green-400 bg-green-400/20' : 'border-red-400 bg-red-400/20'}`}>
              {s === 'goal' ? 'G' : 'S'}
            </div>
          ))}
        </div>

        {sessionResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-sm rounded-2xl border border-white/8 bg-surface-2 p-4"
          >
            <div className="flex justify-center gap-3">
              <div className="rounded-xl bg-surface-3 px-5 py-2 text-center">
                <p className="font-display text-xl font-900 text-brand">+{sessionResult.xpGained}</p>
                <p className="text-[10px] text-gray-400">XP</p>
              </div>
              {sessionResult.coinsGained > 0 && (
                <div className="rounded-xl bg-surface-3 px-5 py-2 text-center">
                  <p className="font-display text-xl font-900 text-yellow-300">+{sessionResult.coinsGained}</p>
                  <p className="text-[10px] text-gray-400">Coins</p>
                </div>
              )}
            </div>
            {!success && <p className="mt-3 text-xs text-gray-500">Next session available in {AR_MODE.SESSION_COOLDOWN_HOURS}h</p>}
          </motion.div>
        )}

        <div className="flex w-full max-w-sm gap-3">
          {!success && (
            <Link href="/scan" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-600/30 bg-red-600/20 py-3 font-display text-sm font-700 uppercase text-red-400">
              <QrCode size={14} />
              Skip Cooldown
            </Link>
          )}
          <button
            onClick={() => {
              setPhase('idle')
              setGoalsScored(0)
              setShotsLeft(AR_MODE.SHOTS_PER_SESSION)
              setShotHistory([])
              setSessionResult(null)
            }}
            className="flex-1 rounded-xl bg-brand py-3 font-display font-800 uppercase text-black"
          >
            {success ? 'Play Again' : 'Back'}
          </button>
        </div>

        {isPending && <LoadingSpinner size={18} />}
      </div>
    )
  }

  return null
}
