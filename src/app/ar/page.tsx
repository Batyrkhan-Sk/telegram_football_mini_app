'use client'

import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Gauge, Goal, QrCode, Share2, Swords, Target, Timer, Trophy, Zap } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/ui'
import { hapticFeedback, shareToTelegram } from '@/lib/telegram'
import { formatTimeLeft } from '@/lib/utils'
import { AR_MODE } from '@/config/game'

type Phase = 'idle' | 'camera' | 'playing' | 'finished'
type PlayMode = 'solo' | 'friend'
type ShotOutcome = 'goal' | 'save' | 'wide' | 'soft'

interface ShotResult {
  outcome: ShotOutcome
  targetX: number
  targetY: number
  power: number
  speed: number
  angle: number
  curve: number
  keeperX: number
  keeperY: number
  reaction: number
}

interface PointerSample {
  x: number
  y: number
  time: number
}

const BALL_START = { x: 50, y: 86 }
const GOAL = {
  left: 12,
  right: 88,
  top: 9,
  bottom: 43,
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

function pctFromPointer(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
  }
}

function evaluateShot(samples: PointerSample[], shotIndex: number): ShotResult {
  const first = samples[0] ?? { ...BALL_START, time: performance.now() }
  const last = samples[samples.length - 1] ?? first
  const previous = samples[Math.max(0, samples.length - 4)] ?? first
  const duration = Math.max(last.time - first.time, 80)
  const dx = last.x - first.x
  const dy = last.y - first.y
  const releaseDx = last.x - previous.x
  const releaseDy = last.y - previous.y
  const releaseSpeed = Math.hypot(releaseDx, releaseDy) / Math.max(last.time - previous.time, 16)
  const dragDistance = Math.hypot(dx, dy)
  const upwardIntent = clamp((first.y - last.y) / 42, 0, 1)
  const power = clamp((dragDistance / 58) * 0.6 + releaseSpeed * 6.5 + upwardIntent * 0.25, 0.08, 1)
  const horizontalAim = clamp(dx / 42, -1.05, 1.05)
  const lift = clamp((first.y - last.y) / 55, 0, 1)
  const curve = clamp((releaseDx - dx * 0.18) / 28, -0.55, 0.55)
  const targetX = clamp(50 + horizontalAim * 34 + curve * 9, 3, 97)
  const targetY = clamp(GOAL.bottom - lift * 32 - power * 8, 4, 58)
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI)
  const timingNoise = Math.sin((shotIndex + 1) * 2.37 + power * 3.1) * 8
  const reaction = clamp(0.5 + power * 0.28 + Math.abs(horizontalAim) * 0.08, 0.45, 0.88)
  const keeperX = clamp(50 + horizontalAim * 26 + curve * 5 + timingNoise * (1 - power * 0.35), 23, 77)
  const keeperY = clamp(30 - lift * 9 + power * 4, 15, 40)
  const inGoal = targetX >= GOAL.left && targetX <= GOAL.right && targetY >= GOAL.top && targetY <= GOAL.bottom
  const hasEnoughPower = power > 0.28 && upwardIntent > 0.18
  const saveRadius = 11.5 + reaction * 8 - power * 4
  const saved = distance(targetX, targetY, keeperX, keeperY) < saveRadius

  let outcome: ShotOutcome = 'goal'
  if (!hasEnoughPower) outcome = 'soft'
  else if (!inGoal) outcome = 'wide'
  else if (saved) outcome = 'save'

  return {
    outcome,
    targetX,
    targetY,
    power,
    speed: releaseSpeed,
    angle,
    curve,
    keeperX,
    keeperY,
    reaction,
  }
}

function outcomeLabel(outcome: ShotOutcome) {
  if (outcome === 'goal') return 'GOAL'
  if (outcome === 'save') return 'SAVED'
  if (outcome === 'soft') return 'TOO SOFT'
  return 'WIDE'
}

function PenaltyArena({
  disabled,
  lastShot,
  onShot,
}: {
  disabled: boolean
  lastShot: ShotResult | null
  onShot: (shot: ShotResult) => void
}) {
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const samplesRef = useRef<PointerSample[]>([])
  const shotCounterRef = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [pointer, setPointer] = useState(BALL_START)
  const [aimPreview, setAimPreview] = useState<{ x: number; y: number; power: number } | null>(null)

  const beginDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !arenaRef.current) return
    const point = pctFromPointer(event, arenaRef.current)
    if (distance(point.x, point.y, BALL_START.x, BALL_START.y) > 20) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const sample = { ...point, time: performance.now() }
    samplesRef.current = [sample]
    setPointer(point)
    setDragging(true)
    setAimPreview({ x: point.x, y: point.y, power: 0 })
    hapticFeedback('light')
  }

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !arenaRef.current) return
    const point = pctFromPointer(event, arenaRef.current)
    const sample = { ...point, time: performance.now() }
    samplesRef.current = [...samplesRef.current.slice(-9), sample]
    const first = samplesRef.current[0]
    const power = clamp(distance(first.x, first.y, point.x, point.y) / 58, 0, 1)
    setPointer(point)
    setAimPreview({ x: clamp(50 + (point.x - first.x) * 0.75, 6, 94), y: clamp(point.y - power * 18, 6, 62), power })
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(false)
    setAimPreview(null)

    const shot = evaluateShot(samplesRef.current, shotCounterRef.current)
    shotCounterRef.current += 1
    samplesRef.current = []
    setPointer(BALL_START)
    hapticFeedback(shot.outcome === 'goal' ? 'success' : 'warning')
    onShot(shot)
  }

  return (
    <div
      ref={arenaRef}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative h-[62vh] min-h-[460px] w-full overflow-hidden rounded-t-[28px] border-t border-white/10 pitch-bg touch-none select-none"
    >
      <div className="absolute inset-x-4 top-8 h-[34%] rounded-t-2xl border-4 border-white/35 bg-black/10">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '16.6% 33.3%',
          }}
        />
      </div>

      <motion.div
        className="absolute z-20 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-2xl shadow-[0_10px_34px_rgba(0,0,0,0.5)]"
        animate={{
          left: `${lastShot ? lastShot.keeperX : 50}%`,
          top: `${lastShot ? lastShot.keeperY : 31}%`,
          rotate: lastShot ? lastShot.curve * 26 : [0, 4, -4, 0],
        }}
        transition={{ type: 'spring', stiffness: 170, damping: 20 }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        <span className="text-base">GK</span>
      </motion.div>

      {aimPreview && (
        <svg className="absolute inset-0 z-10 h-full w-full pointer-events-none">
          <line
            x1={`${BALL_START.x}%`}
            y1={`${BALL_START.y}%`}
            x2={`${aimPreview.x}%`}
            y2={`${aimPreview.y}%`}
            stroke="rgba(245,197,24,0.85)"
            strokeWidth={3 + aimPreview.power * 5}
            strokeLinecap="round"
            strokeDasharray="8 8"
          />
        </svg>
      )}

      <AnimatePresence>
        {lastShot && (
          <motion.div
            key={`${lastShot.targetX}-${lastShot.targetY}-${lastShot.power}`}
            initial={{ left: `${BALL_START.x}%`, top: `${BALL_START.y}%`, scale: 1 }}
            animate={{ left: `${lastShot.targetX}%`, top: `${lastShot.targetY}%`, scale: 0.62 + lastShot.power * 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36 + (1 - lastShot.power) * 0.22, ease: 'easeOut' }}
            className="absolute z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-[0_0_24px_rgba(255,255,255,0.45)]"
            style={{ translateX: '-50%', translateY: '-50%' }}
          >
            <span className="text-lg">o</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute z-30 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-brand text-black shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
        animate={{ left: `${dragging ? pointer.x : BALL_START.x}%`, top: `${dragging ? pointer.y : BALL_START.y}%` }}
        transition={{ type: 'spring', stiffness: dragging ? 500 : 220, damping: 28 }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        <span className="text-xl">o</span>
      </motion.div>

      <div className="absolute inset-x-0 bottom-6 z-20 px-4 text-center">
        <div className="mx-auto max-w-xs rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
          <p className="font-display text-sm font-800 uppercase text-brand">Drag from the ball, then release</p>
          <p className="text-xs text-gray-400">Direction sets angle. Flick speed sets power. Late curve changes placement.</p>
        </div>
      </div>
    </div>
  )
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [playMode, setPlayMode] = useState<PlayMode>('solo')
  const [goalsScored, setGoalsScored] = useState(0)
  const [shotsLeft, setShotsLeft] = useState<number>(AR_MODE.SHOTS_PER_SESSION)
  const [lastShot, setLastShot] = useState<ShotResult | null>(null)
  const [shotHistory, setShotHistory] = useState<ShotResult[]>([])
  const [targetScore, setTargetScore] = useState<number | null>(null)
  const [sessionResult, setSessionResult] = useState<{ success: boolean; xpGained: number; coinsGained: number } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const target = Number(params.get('target'))
    if (Number.isFinite(target) && target >= 0) {
      setPlayMode('friend')
      setTargetScore(clamp(target, 0, AR_MODE.SHOTS_PER_SESSION))
    }
  }, [])

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

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd

  const resetSession = useCallback((mode = playMode) => {
    setPhase('idle')
    setPlayMode(mode)
    setGoalsScored(0)
    setShotsLeft(AR_MODE.SHOTS_PER_SESSION)
    setLastShot(null)
    setShotHistory([])
    setSessionResult(null)
  }, [playMode])

  const startPlaying = () => {
    setGoalsScored(0)
    setShotsLeft(AR_MODE.SHOTS_PER_SESSION)
    setLastShot(null)
    setShotHistory([])
    setSessionResult(null)
    setPhase('playing')
  }

  const handleShot = useCallback((shot: ShotResult) => {
    if (shotsLeft <= 0 || lastShot) return

    const scored = shot.outcome === 'goal'
    const newGoals = goalsScored + (scored ? 1 : 0)
    const newShotsLeft = shotsLeft - 1

    setLastShot(shot)
    setShotHistory((current) => [...current, shot])
    setGoalsScored(newGoals)
    setShotsLeft(newShotsLeft)

    window.setTimeout(() => {
      setLastShot(null)
      if (newShotsLeft === 0) {
        setPhase('finished')
        if (playMode === 'solo') {
          submitSession({ goalsScored: newGoals, totalShots: AR_MODE.SHOTS_PER_SESSION })
        }
      }
    }, 1050)
  }, [goalsScored, lastShot, playMode, shotsLeft, submitSession])

  const shareFriendChallenge = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const url = `${baseUrl}/ar?mode=friend&target=${goalsScored}`
    shareToTelegram(url, `I scored ${goalsScored}/${AR_MODE.SHOTS_PER_SESSION} penalties. Beat my score.`)
  }

  const shotQuality = useMemo(() => {
    if (!lastShot) return null
    return [
      { label: 'Power', value: Math.round(lastShot.power * 100) },
      { label: 'Angle', value: Math.round(Math.abs(lastShot.angle)) },
      { label: 'Curve', value: Math.round(Math.abs(lastShot.curve) * 100) },
    ]
  }, [lastShot])

  if (phase === 'idle') {
    return (
      <div className="flex min-h-screen flex-col pb-24">
        <div className="px-4 pt-4">
          <h1 className="mb-1 font-display text-3xl font-900 uppercase">Penalty AR</h1>
          <p className="mb-5 text-sm text-gray-400">Swipe through the ball to shape your shot.</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPlayMode('solo')}
              className={`rounded-2xl border p-4 text-left ${playMode === 'solo' ? 'border-brand bg-brand/15' : 'border-white/8 bg-surface-2'}`}
            >
              <Target className="mb-3 text-brand" size={22} />
              <p className="font-display font-900 uppercase">AI Keeper</p>
              <p className="text-xs text-gray-400">Score 3+ from 5</p>
            </button>
            <button
              onClick={() => setPlayMode('friend')}
              className={`rounded-2xl border p-4 text-left ${playMode === 'friend' ? 'border-brand bg-brand/15' : 'border-white/8 bg-surface-2'}`}
            >
              <Swords className="mb-3 text-brand" size={22} />
              <p className="font-display font-900 uppercase">Friend</p>
              <p className="text-xs text-gray-400">Set or beat a score</p>
            </button>
          </div>

          <div className="mb-5 rounded-3xl border border-brand/20 bg-surface-2 p-4">
            <div className="relative mx-auto mb-4 h-52 max-w-sm overflow-hidden rounded-2xl border border-white/10 pitch-bg">
              <div className="absolute inset-x-8 top-6 h-20 rounded-t-xl border-4 border-white/25" />
              <motion.div
                className="absolute left-1/2 top-16 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-slate-900 text-xs font-display font-900"
                animate={{ x: [-42, 36, -18, 18, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                GK
              </motion.div>
              <motion.div
                className="absolute bottom-8 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-brand text-black"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                o
              </motion.div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Gauge, label: 'Velocity', value: 'Flick' },
                { icon: Goal, label: 'Angle', value: 'Aim' },
                { icon: Zap, label: 'Curve', value: 'Late drag' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-surface-3 p-3 text-center">
                  <Icon size={16} className="mx-auto mb-1 text-brand" />
                  <p className="font-display font-900 text-sm uppercase text-brand">{value}</p>
                  <p className="text-[9px] uppercase text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {targetScore !== null && playMode === 'friend' && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand/10 p-4">
              <Trophy size={20} className="text-brand" />
              <div>
                <p className="font-display font-900 uppercase text-brand">Friend score: {targetScore}/{AR_MODE.SHOTS_PER_SESSION}</p>
                <p className="text-xs text-gray-400">Beat it to win the challenge.</p>
              </div>
            </div>
          )}

          {onCooldown && playMode === 'solo' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <Timer size={20} className="text-red-400" />
                <div>
                  <p className="font-display font-800 uppercase text-red-400">Mode on Cooldown</p>
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
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-900 uppercase text-black"
            >
              <Camera size={20} />
              Start Gesture Session
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
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <Camera size={64} className="mx-auto mb-3 text-brand" />
          <h2 className="mb-2 font-display text-2xl font-900 uppercase">Gesture AR Setup</h2>
          <p className="text-sm text-gray-400">Simulated AR goal is ready. Shoot by dragging from the ball and releasing toward the net.</p>
        </motion.div>

        <div className="w-full rounded-2xl border border-white/8 bg-surface-2 p-4 text-left">
          <p className="mb-2 font-display text-sm font-800 uppercase text-gray-400">Football rules</p>
          <p className="text-sm text-gray-300">1. Start your swipe on the ball.</p>
          <p className="text-sm text-gray-300">2. Fast release adds acceleration.</p>
          <p className="text-sm text-gray-300">3. Side movement bends the shot.</p>
          <p className="text-sm text-gray-300">4. Keeper reads your angle and reacts late.</p>
        </div>

        <button onClick={startPlaying} className="w-full rounded-2xl bg-brand py-4 font-display text-lg font-900 uppercase text-black">
          Ready - Start
        </button>
      </div>
    )
  }

  if (phase === 'playing') {
    return (
      <div className="flex min-h-screen flex-col bg-surface-0">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: AR_MODE.SHOTS_PER_SESSION }).map((_, index) => {
              const shot = shotHistory[index]
              return (
                <div
                  key={index}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-display font-900 ${
                    shot?.outcome === 'goal' ? 'border-green-400 bg-green-400/20 text-green-300' :
                    shot ? 'border-red-400 bg-red-400/20 text-red-300' :
                    'border-white/20 bg-surface-3 text-gray-500'
                  }`}
                >
                  {shot?.outcome === 'goal' ? 'G' : shot ? 'X' : ''}
                </div>
              )
            })}
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-900 text-brand">{goalsScored}</p>
            <p className="text-[10px] uppercase text-gray-400">Goals</p>
          </div>
        </div>

        <div className="relative flex-1">
          <AnimatePresence>
            {lastShot && (
              <motion.div
                key={`${lastShot.outcome}-${shotHistory.length}`}
                initial={{ opacity: 0, y: -8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute left-4 right-4 top-3 z-40 rounded-2xl border border-white/10 bg-black/65 p-3 text-center backdrop-blur"
              >
                <p className={`font-display text-3xl font-900 uppercase ${lastShot.outcome === 'goal' ? 'text-green-400' : 'text-red-400'}`}>
                  {outcomeLabel(lastShot.outcome)}
                </p>
                {shotQuality && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {shotQuality.map((metric) => (
                      <div key={metric.label} className="rounded-lg bg-white/8 px-2 py-1">
                        <p className="text-[9px] uppercase text-gray-400">{metric.label}</p>
                        <p className="font-display font-900 text-brand">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <PenaltyArena disabled={!!lastShot || shotsLeft <= 0} lastShot={lastShot} onShot={handleShot} />
        </div>

        <div className="border-t border-white/8 bg-surface-0 px-4 py-3">
          <p className="text-center font-display text-sm font-800 uppercase text-gray-400">
            {shotsLeft} shot{shotsLeft !== 1 ? 's' : ''} left {playMode === 'friend' && targetScore !== null ? `- beat ${targetScore}` : ''}
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'finished') {
    const totalShots = AR_MODE.SHOTS_PER_SESSION
    const success = playMode === 'friend'
      ? targetScore === null ? goalsScored >= AR_MODE.GOALS_TO_WIN : goalsScored > targetScore
      : goalsScored >= AR_MODE.GOALS_TO_WIN

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl ${success ? 'bg-brand/15' : 'bg-red-500/10'}`}>
            <Trophy className={success ? 'text-brand' : 'text-red-400'} size={34} />
          </div>
          <h1 className={`font-display text-4xl font-900 uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {success ? 'Clinical' : 'Denied'}
          </h1>
          <p className="mt-1 text-lg text-gray-400">{goalsScored} / {totalShots} scored</p>
          {playMode === 'friend' && targetScore !== null && (
            <p className="mt-1 text-sm text-gray-500">Friend target: {targetScore}</p>
          )}
        </motion.div>

        <div className="flex justify-center gap-2">
          {shotHistory.map((shot, index) => (
            <div
              key={index}
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-display font-900 ${
                shot.outcome === 'goal' ? 'border-green-400 bg-green-400/20 text-green-300' : 'border-red-400 bg-red-400/20 text-red-300'
              }`}
            >
              {shot.outcome === 'goal' ? 'G' : 'X'}
            </div>
          ))}
        </div>

        {playMode === 'solo' && sessionResult && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-2xl border border-white/8 bg-surface-2 p-4">
            <div className="flex justify-center gap-3">
              <div className="rounded-xl bg-surface-3 px-5 py-2">
                <p className="font-display text-xl font-900 text-brand">+{sessionResult.xpGained}</p>
                <p className="text-[10px] text-gray-400">XP</p>
              </div>
              {sessionResult.coinsGained > 0 && (
                <div className="rounded-xl bg-surface-3 px-5 py-2">
                  <p className="font-display text-xl font-900 text-yellow-300">+{sessionResult.coinsGained}</p>
                  <p className="text-[10px] text-gray-400">Coins</p>
                </div>
              )}
            </div>
            {!success && <p className="mt-3 text-xs text-gray-500">Next solo session available in {AR_MODE.SESSION_COOLDOWN_HOURS}h</p>}
          </motion.div>
        )}

        {playMode === 'friend' && (
          <button
            onClick={shareFriendChallenge}
            className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface-2 py-3.5 font-display font-800 uppercase"
          >
            <Share2 size={16} />
            Challenge Friend
          </button>
        )}

        <div className="flex w-full max-w-sm gap-3">
          {playMode === 'solo' && !success && (
            <Link href="/scan" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-600/30 bg-red-600/20 py-3 font-display text-sm font-700 uppercase text-red-400">
              <QrCode size={14} />
              Skip Cooldown
            </Link>
          )}
          <button onClick={() => resetSession(playMode)} className="flex-1 rounded-xl bg-brand py-3 font-display font-900 uppercase text-black">
            Back
          </button>
        </div>

        {isPending && <LoadingSpinner size={18} />}
      </div>
    )
  }

  return null
}
