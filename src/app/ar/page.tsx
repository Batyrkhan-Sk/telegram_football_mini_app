'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { QrCode, Timer, Target, Zap } from 'lucide-react'
import Link from 'next/link'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { hapticFeedback } from '@/lib/telegram'
import { formatTimeLeft } from '@/lib/utils'
import { AR_MODE } from '@/config/game'

type Phase = 'idle' | 'loading' | 'scanning' | 'playing' | 'result'

interface ArResult {
  goalsScored: number
  totalShots: number
  success: boolean
  xpGained: number
  coinsGained: number
}

const TOTAL_SHOTS = AR_MODE.SHOTS_PER_SESSION
const GOALS_TO_WIN = AR_MODE.GOALS_TO_WIN


function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function loadMindAR() {
  await loadScript('https://aframe.io/releases/1.6.0/aframe.min.js')
  await loadScript('https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/dist/mindar-image.prod.js')
  await loadScript('https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/dist/mindar-image-aframe.prod.js')
}

export default function ArPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const sceneRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ArResult | null>(null)
  const [goalsScored, setGoalsScored] = useState(0)
  const [shotDots, setShotDots] = useState<Array<'pending' | 'goal' | 'miss'>>(
    Array(TOTAL_SHOTS).fill('pending')
  )
  const [targetFound, setTargetFound] = useState(false)
  const [shotsLeft, setShotsLeft] = useState<number>(TOTAL_SHOTS)
  const [flashMsg, setFlashMsg] = useState<{ text: string; type: 'goal' | 'miss' } | null>(null)

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


  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])


  const startAR = async () => {
    setPhase('loading')
    setGoalsScored(0)
    setShotsLeft(TOTAL_SHOTS)
    setShotDots(Array(TOTAL_SHOTS).fill('pending'))
    setTargetFound(false)
    shotsLeftRef.current = TOTAL_SHOTS
    goalsScoredRef.current = 0

    try {
      await loadMindAR()

      let targetSrc = DEMO_TARGET
      try {
        const res = await fetch(SNICKERS_TARGET, { method: 'HEAD' })
        if (res.ok) targetSrc = SNICKERS_TARGET
      } catch {}

      setPhase('scanning')
      injectAFrameScene(targetSrc)
    } catch (err) {
      console.error('Failed to load MindAR:', err)
      setPhase('idle')
    }
  }

  const SNICKERS_TARGET = '/targets/snickers.mind'
  const DEMO_TARGET = 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind'

  const injectAFrameScene = (targetSrc: string) => {
    if (!sceneRef.current) return

    const sceneHTML = `
      <a-scene
        id="mindar-scene"
        mindar-image="imageTargetSrc: ${targetSrc}; filterMinCF: 0.001; filterBeta: 100; missTolerance: 10;"
        color-space="sRGB"
        renderer="colorManagement: true; physicallyCorrectLights: true;"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        style="width:100%;height:100%;position:absolute;top:0;left:0;"
      >
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
        <a-entity id="ar-target" mindar-image-target="targetIndex: 0">
          <!-- Crossbar -->
          <a-box color="#FFFFFF" width="1.6" height="0.04" depth="0.04"
                 position="0 0.8 0" material="opacity: 0.95"></a-box>
          <!-- Left post -->
          <a-box color="#FFFFFF" width="0.04" height="0.8" depth="0.04"
                 position="-0.78 0.4 0" material="opacity: 0.95"></a-box>
          <!-- Right post -->
          <a-box color="#FFFFFF" width="0.04" height="0.8" depth="0.04"
                 position="0.78 0.4 0" material="opacity: 0.95"></a-box>
          <!-- Net -->
          <a-plane color="#FFFFFF" width="1.52" height="0.76"
                   position="0 0.38 -0.08"
                   material="opacity: 0.1; side: double;"></a-plane>
          <!-- Goalkeeper -->
          <a-box id="gk-box" color="#C8102E" width="0.22" height="0.45" depth="0.08"
                 position="0 0.23 -0.06"
                 animation="property: position; from: -0.38 0.23 -0.06; to: 0.38 0.23 -0.06; dur: 1400; dir: alternate; loop: true; easing: easeInOutSine;">
          </a-box>
          <!-- Ball -->
          <a-sphere id="ar-ball" color="#F5C518" radius="0.065"
                    position="0 0.065 0.4"
                    material="roughness: 0.3;"></a-sphere>
          <!-- Kairat label -->
          <a-text value="FC KAIRAT" color="#F5C518" align="center"
                  width="2" position="0 1.05 0.01"></a-text>
        </a-entity>
      </a-scene>
    `

    sceneRef.current.innerHTML = sceneHTML

    const interval = setInterval(() => {
      const scene = document.getElementById('mindar-scene') as any
      const arTarget = document.getElementById('ar-target')
      if (!scene || !arTarget) return
      clearInterval(interval)

      arTarget.addEventListener('targetFound', () => {
        setTargetFound(true)
      })
      arTarget.addEventListener('targetLost', () => {
        setTargetFound(false)
      })

      cleanupRef.current = () => {
        try {
          scene.systems?.['mindar-image-system']?.stop?.()
          scene.parentNode?.removeChild(scene)
        } catch {}
      }
    }, 200)
  }

  const shotsLeftRef = useRef(TOTAL_SHOTS)
  const goalsScoredRef = useRef(0)

  const handleShot = (zone: string) => {
    if (shotsLeftRef.current <= 0 || !targetFound) return
    hapticFeedback('medium')

    const gkZones = ['mid-center', 'low-center', 'mid-left', 'mid-right']
    const saveChance = gkZones.includes(zone) ? 0.55 : 0.28
    const isGoal = Math.random() > saveChance

    const shotIdx = TOTAL_SHOTS - shotsLeftRef.current
    setShotDots((prev) => {
      const next = [...prev]
      next[shotIdx] = isGoal ? 'goal' : 'miss'
      return next
    })

    if (isGoal) {
      goalsScoredRef.current++
      setGoalsScored(goalsScoredRef.current)
      animateBall(zone)
      setFlashMsg({ text: 'GOAL!', type: 'goal' })
    } else {
      setFlashMsg({ text: 'SAVED!', type: 'miss' })
    }

    setTimeout(() => setFlashMsg(null), 900)

    shotsLeftRef.current--
    setShotsLeft(shotsLeftRef.current)

    if (shotsLeftRef.current <= 0) {
      setTimeout(() => {
        cleanupRef.current?.()
        submitSession({ goalsScored: goalsScoredRef.current, totalShots: TOTAL_SHOTS })
      }, 1200)
    }
  }

  const animateBall = (zone: string) => {
    const ball = document.getElementById('ar-ball') as any
    if (!ball) return
    const positions: Record<string, string> = {
      'top-left': '-0.55 0.65 -0.1', 'top-center': '0 0.65 -0.1', 'top-right': '0.55 0.65 -0.1',
      'mid-left': '-0.55 0.35 -0.1', 'mid-center': '0 0.35 -0.1', 'mid-right': '0.55 0.35 -0.1',
      'low-left': '-0.55 0.1 -0.1',  'low-center': '0 0.1 -0.1',  'low-right': '0.55 0.1 -0.1',
    }
    const to = positions[zone] ?? '0 0.35 -0.1'
    ball.setAttribute('animation__shot', `property: position; from: 0 0.065 0.4; to: ${to}; dur: 380; easing: easeInQuad`)
    setTimeout(() => {
      ball.removeAttribute('animation__shot')
      ball.setAttribute('position', '0 0.065 0.4')
    }, 750)
  }

  const exitAR = () => {
    cleanupRef.current?.()
    setPhase('idle')
    setTargetFound(false)
    shotsLeftRef.current = TOTAL_SHOTS
    goalsScoredRef.current = 0
  }

  const onCooldown = arStatus?.data?.onCooldown
  const cooldownEnd = arStatus?.data?.cooldownEnd


  if (phase === 'loading' || phase === 'scanning' || phase === 'playing') {
    const ZONES = [
      ['top-left', 'top-center', 'top-right'],
      ['mid-left', 'mid-center', 'mid-right'],
      ['low-left', 'low-center', 'low-right'],
    ]

    return (
      <div className="fixed inset-0 z-50 bg-black overflow-hidden">

        <div ref={sceneRef} className="absolute inset-0" />

        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black">
            <div className="w-10 h-10 border-2 border-white/20 border-t-brand rounded-full animate-spin" />
            <p className="font-display font-800 uppercase text-sm text-gray-300">Loading AR…</p>
          </div>
        )}

        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {shotDots.map((state, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                state === 'goal' ? 'border-green-400 bg-green-400/30'
                : state === 'miss' ? 'border-red-400 bg-red-400/30'
                : 'border-white/30 bg-black/40'
              }`}
            >
              {state === 'goal' ? '⚽' : state === 'miss' ? '🧤' : ''}
            </div>
          ))}
        </div>

        <div className="absolute top-4 right-4 z-10 bg-black/70 border border-brand/40 rounded-xl px-3 py-2 text-center">
          <p className="font-display font-900 text-2xl text-brand leading-none">{goalsScored}</p>
          <p className="text-[9px] text-gray-400 uppercase">Goals</p>
        </div>

        <button
          onClick={exitAR}
          className="absolute top-4 left-4 z-10 bg-black/70 border border-white/20 text-white font-display font-800 uppercase text-xs px-3 py-2 rounded-xl"
        >
          ✕ Exit
        </button>

        {(phase === 'scanning' || (phase === 'playing' && !targetFound)) && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-72 bg-black/80 border border-red-700/50 rounded-2xl px-4 py-3 text-center z-10">
            <p className="text-[10px] font-display font-900 uppercase text-red-400 mb-1">🍫 Point at SNICKERS</p>
            <p className="text-xs text-gray-300">Hold your camera over a SNICKERS bar to place the goal</p>
          </div>
        )}

        {flashMsg && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.p
              key={flashMsg.text + Date.now()}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className={`font-display font-900 text-5xl uppercase tracking-widest drop-shadow-2xl ${
                flashMsg.type === 'goal' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {flashMsg.text}
            </motion.p>
          </div>
        )}

        {targetFound && phase !== 'loading' && (
          <div
            className="absolute z-10"
            style={{ left: '20%', top: '20%', width: '60%', height: '50%' }}
          >
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0.5">
              {ZONES.flat().map((zone) => (
                <button
                  key={zone}
                  onClick={() => handleShot(zone)}
                  className="bg-brand/5 border border-brand/10 active:bg-brand/25 transition-colors"
                  aria-label={`Shoot ${zone}`}
                />
              ))}
            </div>
            <div className="absolute inset-0 border-2 border-brand/20 rounded pointer-events-none" />
          </div>
        )}
      </div>
    )
  }

  if (phase === 'result' && result) {
    const success = result.goalsScored >= GOALS_TO_WIN
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="text-7xl mb-2">{success ? '🏆' : '😤'}</div>
          <h1 className={`font-display font-900 text-4xl uppercase ${success ? 'text-brand' : 'text-red-400'}`}>
            {success ? 'Outstanding!' : 'So Close!'}
          </h1>
          <p className="text-gray-400 text-lg mt-1">{result.goalsScored} / {result.totalShots} goals</p>
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
          {!success && <p className="text-xs text-gray-500 mt-3 text-center">Next session in {AR_MODE.SESSION_COOLDOWN_HOURS}h</p>}
        </motion.div>

        <div className="flex gap-3 w-full max-w-sm">
          {!success && (
            <Link href="/scan" className="flex-1 flex items-center justify-center gap-1.5 bg-red-600/20 border border-red-600/30 text-red-400 font-display font-700 uppercase py-3 rounded-xl text-sm">
              <QrCode size={14} /> Skip Cooldown
            </Link>
          )}
          <button onClick={() => { setPhase('idle'); setResult(null) }}
            className="flex-1 bg-brand text-black font-display font-800 uppercase py-3 rounded-xl">
            {success ? 'Play Again' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4">
        <h1 className="font-display font-900 text-3xl uppercase mb-1">AR Penalty</h1>
        <p className="text-gray-400 text-sm mb-6">Point your camera at a SNICKERS bar to place a goal in AR</p>

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
            { n: '2', text: 'A football goal appears on top of it in AR' },
            { n: '3', text: 'Tap zones on the goal to shoot — 5 attempts' },
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
            <Link href="/scan" className="flex items-center justify-center gap-2 w-full bg-red-600 text-white font-display font-800 uppercase py-3.5 rounded-2xl">
              <QrCode size={18} /> Scan SNICKERS to Bypass
            </Link>
          </div>
        ) : (
          <button onClick={startAR}
            className="w-full flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase text-lg py-4 rounded-2xl active:scale-95 transition-transform">
            <Target size={20} />
            Start AR Session
          </button>
        )}
      </div>
      <BottomNav />
    </div>
  )
}