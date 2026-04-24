'use client'

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Camera, QrCode, Share2, Swords, Target, Timer, Trophy } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/ui'
import { hapticFeedback, shareToTelegram } from '@/lib/telegram'
import { formatTimeLeft } from '@/lib/utils'
import { AR_MODE } from '@/config/game'

type Phase = 'idle' | 'camera' | 'playing' | 'finished'
type PlayMode = 'computer' | 'friend'
type ShotOutcome = 'goal' | 'save' | 'wide' | 'soft'

interface Body {
  x: number
  y: number
  vx: number
  vy: number
}

interface ShotResult {
  outcome: ShotOutcome
  power: number
  angle: number
  ballX: number
  ballY: number
}

interface ArMatch {
  id: string
  status: 'PENDING' | 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  maxRounds: number
  currentTurnUserId: string | null
  winnerId: string | null
  player1Goals: number
  player2Goals: number
  player1Shots: number
  player2Shots: number
  isYourTurn: boolean
  canJoin: boolean
  isParticipant: boolean
  player1: { id: string; firstName: string | null; username: string | null }
  player2: { id: string; firstName: string | null; username: string | null } | null
  shots: Array<{ id: string; userId: string; round: number; outcome: string; power: number; angle: number }>
}

interface ArenaSnapshot {
  ball: Body
  striker: Body
  keeper: Body
  target: { x: number; y: number }
  controlling: boolean
}

const FIELD = {
  minX: 7,
  maxX: 93,
  minY: 5,
  maxY: 94,
  goalLeft: 31,
  goalRight: 69,
  goalLineY: 7,
  keeperY: 13,
  ballStartX: 50,
  ballStartY: 58,
  strikerStartX: 50,
  strikerStartY: 75,
}

const BALL_RADIUS = 4.2
const STRIKER_RADIUS = 8.6
const KEEPER_RADIUS = 8

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

function pointFromEvent(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect()
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 100, FIELD.minX, FIELD.maxX),
    y: clamp(((event.clientY - rect.top) / rect.height) * 100, 48, FIELD.maxY),
  }
}

function outcomeLabel(outcome: ShotOutcome) {
  if (outcome === 'goal') return 'GOAL'
  if (outcome === 'save') return 'SAVED'
  if (outcome === 'soft') return 'TOO SOFT'
  return 'WIDE'
}

function initialSnapshot(): ArenaSnapshot {
  return {
    ball: { x: FIELD.ballStartX, y: FIELD.ballStartY, vx: 0, vy: 0 },
    striker: { x: FIELD.strikerStartX, y: FIELD.strikerStartY, vx: 0, vy: 0 },
    keeper: { x: 50, y: FIELD.keeperY, vx: 0, vy: 0 },
    target: { x: FIELD.strikerStartX, y: FIELD.strikerStartY },
    controlling: false,
  }
}

function TopDownPenaltyArena({
  disabled,
  resetKey,
  onShot,
}: {
  disabled: boolean
  resetKey: number
  onShot: (shot: ShotResult) => void
}) {
  const fieldRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const snapshotRef = useRef<ArenaSnapshot>(initialSnapshot())
  const shotLockedRef = useRef(false)
  const lastHitAtRef = useRef(0)
  const [snapshot, setSnapshot] = useState<ArenaSnapshot>(initialSnapshot())
  const [feedback, setFeedback] = useState<ShotResult | null>(null)

  const resetArena = useCallback(() => {
    const next = initialSnapshot()
    snapshotRef.current = next
    shotLockedRef.current = false
    lastHitAtRef.current = 0
    setFeedback(null)
    setSnapshot(next)
  }, [])

  useEffect(() => {
    resetArena()
  }, [resetArena, resetKey])

  useEffect(() => {
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = clamp((now - lastTime) / 16.67, 0.5, 1.8)
      lastTime = now
      const current = snapshotRef.current
      const striker = { ...current.striker }
      const ball = { ...current.ball }
      const keeper = { ...current.keeper }

      if (!disabled) {
        const follow = current.controlling ? 0.42 : 0.18
        const nextX = striker.x + (current.target.x - striker.x) * follow * dt
        const nextY = striker.y + (current.target.y - striker.y) * follow * dt
        striker.vx = (nextX - striker.x) / dt
        striker.vy = (nextY - striker.y) / dt
        striker.x = clamp(nextX, FIELD.minX + STRIKER_RADIUS, FIELD.maxX - STRIKER_RADIUS)
        striker.y = clamp(nextY, 50, FIELD.maxY - STRIKER_RADIUS)

        const keeperTarget = clamp(ball.x, FIELD.goalLeft + 5, FIELD.goalRight - 5)
        const keeperNextX = keeper.x + (keeperTarget - keeper.x) * 0.055 * dt
        keeper.vx = (keeperNextX - keeper.x) / dt
        keeper.x = keeperNextX

        const ballSpeed = Math.hypot(ball.vx, ball.vy)
        if (ballSpeed > 0.02) {
          ball.x += ball.vx * dt
          ball.y += ball.vy * dt
          ball.vx *= 0.987 ** dt
          ball.vy *= 0.987 ** dt
        } else {
          ball.vx = 0
          ball.vy = 0
        }

        if (ball.x < FIELD.minX + BALL_RADIUS || ball.x > FIELD.maxX - BALL_RADIUS) {
          ball.x = clamp(ball.x, FIELD.minX + BALL_RADIUS, FIELD.maxX - BALL_RADIUS)
          ball.vx *= -0.72
        }

        if (ball.y > FIELD.maxY - BALL_RADIUS) {
          ball.y = FIELD.maxY - BALL_RADIUS
          ball.vy *= -0.5
        }

        const strikerDistance = dist(striker.x, striker.y, ball.x, ball.y)
        const collisionDistance = STRIKER_RADIUS + BALL_RADIUS
        if (strikerDistance < collisionDistance && now - lastHitAtRef.current > 90) {
          const nx = (ball.x - striker.x) / Math.max(strikerDistance, 0.001)
          const ny = (ball.y - striker.y) / Math.max(strikerDistance, 0.001)
          const strikerSpeed = Math.hypot(striker.vx, striker.vy)
          const directionalForce = Math.max(0, striker.vx * nx + striker.vy * ny)
          const upwardBoost = Math.max(0, -striker.vy) * 0.42
          const impulse = clamp(0.9 + directionalForce * 1.15 + strikerSpeed * 0.2 + upwardBoost, 1.25, 7.8)

          ball.x = striker.x + nx * collisionDistance
          ball.y = striker.y + ny * collisionDistance
          ball.vx = nx * impulse + striker.vx * 0.24
          ball.vy = ny * impulse + striker.vy * 0.36 - upwardBoost * 0.2
          lastHitAtRef.current = now
          hapticFeedback('medium')
        }

        const keeperDistance = dist(keeper.x, keeper.y, ball.x, ball.y)
        if (!shotLockedRef.current && keeperDistance < KEEPER_RADIUS + BALL_RADIUS && ball.vy < 0) {
          shotLockedRef.current = true
          const speed = Math.hypot(ball.vx, ball.vy)
          const result: ShotResult = {
            outcome: 'save',
            power: clamp(speed / 7.5, 0, 1),
            angle: Math.atan2(-ball.vy, ball.vx) * (180 / Math.PI),
            ballX: ball.x,
            ballY: ball.y,
          }
          ball.vx *= -0.22
          ball.vy = Math.abs(ball.vy) * 0.35
          setFeedback(result)
          onShot(result)
          hapticFeedback('warning')
        }

        if (!shotLockedRef.current && ball.y <= FIELD.goalLineY + BALL_RADIUS) {
          shotLockedRef.current = true
          const speed = Math.hypot(ball.vx, ball.vy)
          const inGoal = ball.x >= FIELD.goalLeft && ball.x <= FIELD.goalRight
          const result: ShotResult = {
            outcome: inGoal ? 'goal' : 'wide',
            power: clamp(speed / 7.5, 0, 1),
            angle: Math.atan2(-ball.vy, ball.vx) * (180 / Math.PI),
            ballX: ball.x,
            ballY: ball.y,
          }
          setFeedback(result)
          onShot(result)
          hapticFeedback(inGoal ? 'success' : 'warning')
        }

        if (!shotLockedRef.current && lastHitAtRef.current > 0 && ballSpeed < 0.08 && now - lastHitAtRef.current > 850) {
          shotLockedRef.current = true
          const result: ShotResult = {
            outcome: 'soft',
            power: clamp(ballSpeed / 7.5, 0, 1),
            angle: Math.atan2(-ball.vy, ball.vx) * (180 / Math.PI),
            ballX: ball.x,
            ballY: ball.y,
          }
          setFeedback(result)
          onShot(result)
          hapticFeedback('warning')
        }
      }

      const nextSnapshot = { ...current, ball, striker, keeper }
      snapshotRef.current = nextSnapshot
      setSnapshot(nextSnapshot)
      frameRef.current = window.requestAnimationFrame(tick)
    }

    frameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [disabled, onShot])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !fieldRef.current) return
    const point = pointFromEvent(event, fieldRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    snapshotRef.current = {
      ...snapshotRef.current,
      target: point,
      controlling: true,
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !fieldRef.current || !snapshotRef.current.controlling) return
    snapshotRef.current = {
      ...snapshotRef.current,
      target: pointFromEvent(event, fieldRef.current),
    }
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!snapshotRef.current.controlling) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    snapshotRef.current = {
      ...snapshotRef.current,
      controlling: false,
    }
  }

  return (
    <div
      ref={fieldRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="relative h-[70vh] min-h-[560px] w-full overflow-hidden rounded-[28px] border border-yellow-900/70 bg-[#5D9F17] touch-none select-none shadow-[inset_0_0_0_6px_rgba(111,52,15,0.55)]"
      style={{
        backgroundImage:
          'linear-gradient(180deg, rgba(255,255,255,0.08) 0 12.5%, transparent 12.5% 25%, rgba(0,0,0,0.08) 25% 37.5%, transparent 37.5% 50%, rgba(255,255,255,0.08) 50% 62.5%, transparent 62.5% 75%, rgba(0,0,0,0.08) 75% 87.5%, transparent 87.5%)',
      }}
    >
      <div className="absolute inset-x-[18%] top-3 h-[7%] border-x-4 border-t-4 border-white/80" />
      <div className="absolute inset-x-[32%] top-0 h-3 rounded-b-md bg-white/85" />
      <div className="absolute inset-x-[18%] bottom-3 h-[7%] border-x-4 border-b-4 border-white/80" />
      <div className="absolute inset-x-[32%] bottom-0 h-3 rounded-t-md bg-white/85" />
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-white/85" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" />
      <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" />

      <motion.div
        className="absolute z-20 flex h-16 w-16 items-center justify-center rounded-full border-[7px] border-red-700 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
        animate={{ left: `${snapshot.keeper.x}%`, top: `${snapshot.keeper.y}%` }}
        transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.55 }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        <div className="h-9 w-9 rounded-full bg-green-600" />
      </motion.div>

      <motion.div
        className="absolute z-30 flex h-10 w-10 items-center justify-center rounded-full border border-black/30 bg-white shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
        animate={{ left: `${snapshot.ball.x}%`, top: `${snapshot.ball.y}%`, rotate: snapshot.ball.x * 6 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.35 }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        <div className="h-6 w-6 rounded-full border-4 border-black/80 bg-white" />
      </motion.div>

      <motion.div
        className="absolute z-40 flex h-20 w-20 items-center justify-center rounded-full border-[8px] border-slate-300 bg-slate-500 shadow-[0_14px_34px_rgba(0,0,0,0.42)]"
        animate={{
          left: `${snapshot.striker.x}%`,
          top: `${snapshot.striker.y}%`,
          scale: snapshot.controlling ? 1.04 : 1,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.45 }}
        style={{ translateX: '-50%', translateY: '-50%' }}
      >
        <div className="h-10 w-10 rounded-full bg-red-600" />
      </motion.div>

      {snapshot.controlling && (
        <motion.div
          className="absolute z-10 h-7 w-7 rounded-full border border-white/60 bg-white/20"
          animate={{ left: `${snapshot.target.x}%`, top: `${snapshot.target.y}%` }}
          style={{ translateX: '-50%', translateY: '-50%' }}
        />
      )}

      {feedback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.86, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute left-4 right-4 top-24 z-50 rounded-2xl border border-white/20 bg-black/65 px-4 py-3 text-center backdrop-blur"
        >
          <p className={`font-display text-3xl font-900 uppercase ${feedback.outcome === 'goal' ? 'text-green-400' : 'text-red-400'}`}>
            {outcomeLabel(feedback.outcome)}
          </p>
          <p className="text-xs text-gray-300">
            Power {Math.round(feedback.power * 100)} · Angle {Math.round(Math.abs(feedback.angle))}°
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [phase, setPhase] = useState<Phase>('idle')
  const [playMode, setPlayMode] = useState<PlayMode>('computer')
  const [goalsScored, setGoalsScored] = useState(0)
  const [shotsLeft, setShotsLeft] = useState<number>(AR_MODE.SHOTS_PER_SESSION)
  const [shotHistory, setShotHistory] = useState<ShotResult[]>([])
  const [shotLocked, setShotLocked] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [sessionResult, setSessionResult] = useState<{ success: boolean; xpGained: number; coinsGained: number } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const match = params.get('match')
    if (match) {
      setPlayMode('friend')
      setMatchId(match)
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

  const { data: matchData, refetch: refetchMatch, isFetching: isMatchFetching } = useQuery<{ data: ArMatch }>({
    queryKey: ['ar-match', matchId, user?.telegramId],
    queryFn: () => fetch(`/api/ar/match?id=${matchId}&telegramId=${user?.telegramId}`).then((response) => response.json()),
    enabled: !!matchId && !!user?.telegramId,
    refetchInterval: (query) => {
      const match = query.state.data?.data
      return match && match.status !== 'COMPLETED' ? 5000 : false
    },
  })

  const currentMatch = matchData?.data

  const { mutate: createMatch, isPending: isCreatingMatch } = useMutation({
    mutationFn: () =>
      fetch('/api/ar/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user?.telegramId }),
      }).then((response) => response.json()),
    onSuccess: (res) => {
      if (!res.data) return
      setMatchId(res.data.id)
      setGoalsScored(0)
      setShotsLeft(AR_MODE.SHOTS_PER_SESSION)
      setShotHistory([])
      setPhase('camera')
    },
  })

  const { mutate: joinMatch, isPending: isJoiningMatch } = useMutation({
    mutationFn: () =>
      fetch(`/api/ar/match?id=${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', telegramId: user?.telegramId }),
      }).then((response) => response.json()),
    onSuccess: () => {
      refetchMatch()
      setPhase('camera')
    },
  })

  const { mutate: submitMatchShot, isPending: isSubmittingMatchShot } = useMutation({
    mutationFn: (shot: ShotResult) =>
      fetch(`/api/ar/match?id=${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shot',
          telegramId: user?.telegramId,
          outcome: shot.outcome,
          power: shot.power,
          angle: shot.angle,
        }),
      }).then((response) => response.json()),
    onSuccess: (res) => {
      if (res.data) {
        refetchMatch()
        if (res.data.status === 'COMPLETED') setPhase('finished')
      }
    },
  })

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd

  const startSession = () => {
    if (playMode === 'friend' && !matchId) {
      createMatch()
      return
    }
    if (playMode === 'friend' && currentMatch && !currentMatch.isYourTurn) {
      return
    }
    setGoalsScored(0)
    setShotsLeft(playMode === 'friend' ? matchShotsLeft : AR_MODE.SHOTS_PER_SESSION)
    setShotHistory([])
    setSessionResult(null)
    setShotLocked(false)
    setResetKey((key) => key + 1)
    setPhase('playing')
  }

  const resetSession = () => {
    setPhase('idle')
    setGoalsScored(0)
    setShotsLeft(AR_MODE.SHOTS_PER_SESSION)
    setShotHistory([])
    setSessionResult(null)
    setShotLocked(false)
    setResetKey((key) => key + 1)
  }

  const youArePlayer1 = !!currentMatch && currentMatch.player1.id === user?.id
  const yourMatchShots = currentMatch
    ? currentMatch.shots.filter((shot) => shot.userId === user?.id)
    : []
  const yourMatchGoals = yourMatchShots.filter((shot) => shot.outcome === 'GOAL').length
  const matchShotsLeft = currentMatch ? currentMatch.maxRounds - yourMatchShots.length : shotsLeft

  const handleShot = useCallback((shot: ShotResult) => {
    const availableShots = playMode === 'friend' ? matchShotsLeft : shotsLeft
    if (shotLocked || availableShots <= 0) return

    setShotLocked(true)
    const scored = shot.outcome === 'goal'
    const newGoals = goalsScored + (scored ? 1 : 0)
    const newShotsLeft = shotsLeft - 1

    setGoalsScored(newGoals)
    setShotsLeft(newShotsLeft)
    setShotHistory((history) => [...history, shot])

    if (playMode === 'friend') {
      submitMatchShot(shot)
      window.setTimeout(() => {
        setShotLocked(false)
        setPhase('idle')
        setResetKey((key) => key + 1)
      }, 1200)
      return
    }

    window.setTimeout(() => {
      setShotLocked(false)
      if (newShotsLeft === 0) {
        setPhase('finished')
        if (playMode === 'computer') {
          submitSession({ goalsScored: newGoals, totalShots: AR_MODE.SHOTS_PER_SESSION })
        }
      } else {
        setResetKey((key) => key + 1)
      }
    }, 1200)
  }, [goalsScored, matchShotsLeft, playMode, shotLocked, shotsLeft, submitMatchShot, submitSession])

  const shareFriendChallenge = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const url = `${baseUrl}/ar?match=${matchId}`
    shareToTelegram(url, 'Join my turn-based Kairat penalty match.')
  }
  const friendPrimaryLabel = !matchId
    ? 'Create Friend Match'
    : currentMatch?.canJoin
      ? 'Join Match'
      : currentMatch?.status === 'COMPLETED'
        ? 'View Result'
        : currentMatch?.isYourTurn
          ? 'Take Your Turn'
          : 'Waiting For Opponent'

  if (phase === 'idle') {
    return (
      <div className="flex min-h-screen flex-col pb-24">
        <div className="px-4 pt-4">
          <h1 className="mb-1 font-display text-3xl font-900 uppercase">Penalty AR</h1>
          <p className="mb-5 text-sm text-gray-400">Move the striker with your finger. Hit the ball into the goal.</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setPlayMode('computer')}
              className={`rounded-2xl border p-4 text-left ${playMode === 'computer' ? 'border-brand bg-brand/15' : 'border-white/8 bg-surface-2'}`}
            >
              <Target className="mb-3 text-brand" size={22} />
              <p className="font-display font-900 uppercase">Vs Computer</p>
              <p className="text-xs text-gray-400">Beat the AI keeper</p>
            </button>
            <button
              onClick={() => setPlayMode('friend')}
              className={`rounded-2xl border p-4 text-left ${playMode === 'friend' ? 'border-brand bg-brand/15' : 'border-white/8 bg-surface-2'}`}
            >
              <Swords className="mb-3 text-brand" size={22} />
              <p className="font-display font-900 uppercase">Vs Friend</p>
              <p className="text-xs text-gray-400">Alternate penalty turns</p>
            </button>
          </div>

          <div className="mb-5 rounded-3xl border border-brand/20 bg-surface-2 p-4">
            <div className="relative mx-auto h-72 max-w-sm overflow-hidden rounded-[28px] border border-yellow-900/70 bg-[#5D9F17] shadow-[inset_0_0_0_5px_rgba(111,52,15,0.55)]">
              <div className="absolute left-0 right-0 top-1/2 h-1 bg-white/80" />
              <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/60" />
              <div className="absolute left-1/2 top-[15%] h-16 w-16 -translate-x-1/2 rounded-full border-[7px] border-red-700 bg-white" />
              <div className="absolute left-1/2 top-[54%] h-9 w-9 -translate-x-1/2 rounded-full bg-white" />
              <div className="absolute left-1/2 top-[70%] h-20 w-20 -translate-x-1/2 rounded-full border-[8px] border-slate-300 bg-slate-500">
                <div className="m-auto mt-4 h-10 w-10 rounded-full bg-red-600" />
              </div>
            </div>
          </div>

          {playMode === 'friend' && currentMatch && (
            <div className="mb-4 rounded-2xl border border-brand/25 bg-brand/10 p-4">
              <div className="mb-3 flex items-center gap-3">
                <Trophy size={20} className="text-brand" />
                <div>
                  <p className="font-display font-900 uppercase text-brand">
                    {currentMatch.player1Goals} - {currentMatch.player2Goals}
                  </p>
                  <p className="text-xs text-gray-400">
                    {currentMatch.player1.firstName ?? currentMatch.player1.username ?? 'Player 1'} vs {currentMatch.player2?.firstName ?? currentMatch.player2?.username ?? 'Waiting'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-black/20 p-2">
                  <p className="font-display text-lg font-900">{currentMatch.player1Shots}/{currentMatch.maxRounds}</p>
                  <p className="text-[10px] uppercase text-gray-400">P1 shots</p>
                </div>
                <div className="rounded-xl bg-black/20 p-2">
                  <p className="font-display text-lg font-900">{currentMatch.player2Shots}/{currentMatch.maxRounds}</p>
                  <p className="text-[10px] uppercase text-gray-400">P2 shots</p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-gray-300">
                {currentMatch.status === 'COMPLETED'
                  ? 'Match finished'
                  : currentMatch.isYourTurn
                    ? 'Your turn to kick'
                    : currentMatch.canJoin
                      ? 'Join as player 2'
                      : 'Waiting for the other player'}
              </p>
              {youArePlayer1 && currentMatch.status !== 'COMPLETED' && (
                <button
                  onClick={shareFriendChallenge}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-surface-2 py-3 font-display font-800 uppercase"
                >
                  <Share2 size={16} />
                  Share Match Link
                </button>
              )}
            </div>
          )}

          {onCooldown && playMode === 'computer' ? (
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
          ) : playMode === 'friend' ? (
            <button
              onClick={() => {
                if (!matchId) createMatch()
                else if (currentMatch?.canJoin) joinMatch()
                else if (currentMatch?.status === 'COMPLETED') setPhase('finished')
                else if (currentMatch?.isYourTurn) setPhase('camera')
              }}
              disabled={
                isCreatingMatch ||
                isJoiningMatch ||
                isMatchFetching ||
                (!!matchId && !!currentMatch && !currentMatch.canJoin && !currentMatch.isYourTurn && currentMatch.status !== 'COMPLETED')
              }
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-900 uppercase text-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isCreatingMatch || isJoiningMatch || isMatchFetching ? <LoadingSpinner size={18} /> : <Swords size={20} />}
              {friendPrimaryLabel}
            </button>
          ) : (
            <button
              onClick={() => setPhase('camera')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-4 font-display text-lg font-900 uppercase text-black"
            >
              <Camera size={20} />
              Start Match
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
          <h2 className="mb-2 font-display text-2xl font-900 uppercase">Penalty Setup</h2>
          <p className="text-sm text-gray-400">Your finger controls the striker. Move smoothly, build momentum, and hit the ball toward goal.</p>
        </motion.div>

        <div className="w-full rounded-2xl border border-white/8 bg-surface-2 p-4 text-left">
          <p className="mb-2 font-display text-sm font-800 uppercase text-gray-400">How to play</p>
          <p className="text-sm text-gray-300">1. Touch the lower half of the pitch.</p>
          <p className="text-sm text-gray-300">2. The striker follows your finger smoothly.</p>
          <p className="text-sm text-gray-300">3. Strike through the ball to control power and angle.</p>
          <p className="text-sm text-gray-300">4. Score more than your opponent or beat the AI keeper.</p>
        </div>

        {playMode === 'friend' && currentMatch && (
          <div className="w-full rounded-2xl border border-brand/20 bg-brand/10 p-4 text-center">
            <p className="font-display font-900 uppercase text-brand">
              {currentMatch.player1Goals} - {currentMatch.player2Goals}
            </p>
            <p className="text-xs text-gray-400">
              Turn {yourMatchShots.length + 1} of {currentMatch.maxRounds}
            </p>
          </div>
        )}

        <button onClick={startSession} className="w-full rounded-2xl bg-brand py-4 font-display text-lg font-900 uppercase text-black">
          Ready
        </button>
      </div>
    )
  }

  if (phase === 'playing') {
    return (
      <div className="flex min-h-screen flex-col bg-surface-0 px-3 py-3">
        <div className="mb-3 flex items-center justify-between">
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

        <TopDownPenaltyArena
          disabled={shotLocked || (playMode === 'friend' ? matchShotsLeft <= 0 || !currentMatch?.isYourTurn : shotsLeft <= 0)}
          resetKey={resetKey}
          onShot={handleShot}
        />

        <p className="mt-3 text-center font-display text-sm font-800 uppercase text-gray-400">
          {playMode === 'friend'
            ? `${matchShotsLeft} turn${matchShotsLeft !== 1 ? 's' : ''} left for you`
            : `${shotsLeft} shot${shotsLeft !== 1 ? 's' : ''} left`}
        </p>
      </div>
    )
  }

  if (phase === 'finished') {
    const success = playMode === 'friend'
      ? currentMatch?.winnerId === user?.id
      : goalsScored >= AR_MODE.GOALS_TO_WIN
    const friendDraw = playMode === 'friend' && currentMatch?.status === 'COMPLETED' && !currentMatch.winnerId

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl ${success ? 'bg-brand/15' : 'bg-red-500/10'}`}>
            <Trophy className={success ? 'text-brand' : 'text-red-400'} size={34} />
          </div>
          <h1 className={`font-display text-4xl font-900 uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {friendDraw ? 'Draw' : success ? 'You Win' : 'Denied'}
          </h1>
          <p className="mt-1 text-lg text-gray-400">
            {playMode === 'friend' && currentMatch
              ? `${currentMatch.player1Goals} - ${currentMatch.player2Goals}`
              : `${goalsScored} / ${AR_MODE.SHOTS_PER_SESSION} scored`}
          </p>
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

        {playMode === 'computer' && sessionResult && (
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
            {!success && <p className="mt-3 text-xs text-gray-500">Next computer session available in {AR_MODE.SESSION_COOLDOWN_HOURS}h</p>}
          </motion.div>
        )}

        {playMode === 'friend' && (
          <button
            onClick={shareFriendChallenge}
            disabled={!matchId}
            className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-white/10 bg-surface-2 py-3.5 font-display font-800 uppercase"
          >
            <Share2 size={16} />
            Share Vs Friend Link
          </button>
        )}

        <div className="flex w-full max-w-sm gap-3">
          {playMode === 'computer' && !success && (
            <Link href="/scan" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-600/30 bg-red-600/20 py-3 font-display text-sm font-700 uppercase text-red-400">
              <QrCode size={14} />
              Skip Cooldown
            </Link>
          )}
          <button onClick={resetSession} className="flex-1 rounded-xl bg-brand py-3 font-display font-900 uppercase text-black">
            Back
          </button>
        </div>

        {isPending && <LoadingSpinner size={18} />}
      </div>
    )
  }

  return null
}
