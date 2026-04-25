'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, CheckCircle, XCircle, Camera, Scan, Sparkles } from 'lucide-react'
import { useUserStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { SectionHeader, LoadingSpinner } from '@/components/ui'
import { hapticFeedback, scanQrCode } from '@/lib/telegram'
import { useState } from 'react'
import type { PromoRedemptionResult } from '@/types'

const DEMO_CODES = [
  'SNICKERS-KAIRAT-2026',
  'SNICKERS-KAIRAT-2024',
  'MARS-FC-ALPHA',
  'GOLD-BAR-001',
  'BYPASS-NOW',
]

const REWARD_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  CARD_RESTORE:       { icon: '⚡', label: 'Card Energy Restored', color: 'text-yellow-400' },
  AR_COOLDOWN_BYPASS: { icon: '🎯', label: 'Game Cooldown Removed', color: 'text-green-400' },
  BONUS_COINS:        { icon: '💰', label: 'Bonus Coins',          color: 'text-yellow-300' },
  BONUS_XP:           { icon: '⭐', label: 'Bonus XP',             color: 'text-brand' },
}

export default function ScanPage() {
  const { user } = useUserStore()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [result, setResult] = useState<PromoRedemptionResult | null>(null)
  const [error, setError] = useState('')
  // true = native scanner opened, false = show manual input fallback
  const [showManual, setShowManual] = useState(false)

  const { data: historyData } = useQuery({
    queryKey: ['scan-history', user?.telegramId],
    queryFn: () => fetch(`/api/scan?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  const { mutate: redeem, isPending } = useMutation({
    mutationFn: (overrideCode?: string) =>
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user?.telegramId,
          code: (overrideCode ?? code).trim().toUpperCase(),
        }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        setError(res.error)
        setResult(null)
        hapticFeedback('error')
      } else if (res.data) {
        setResult(res.data)
        setError('')
        setCode('')
        hapticFeedback('success')
        qc.invalidateQueries({ queryKey: ['scan-history'] })
        qc.invalidateQueries({ queryKey: ['cards'] })
        qc.invalidateQueries({ queryKey: ['ar-status'] })
      }
    },
  })

  const handleNativeScan = () => {
    setError('')
    setResult(null)

    // Try Telegram's native scanner first (iOS + Android)
    const opened = scanQrCode((scannedCode) => {
      if (!scannedCode) return
      setCode(scannedCode)
      redeem(scannedCode)
    })

    if (!opened) {
      // Not on Telegram mobile (e.g. desktop web) — show manual input
      setShowManual(true)
      setError('Native scanner unavailable here. Enter your code below.')
    }
  }

  const history = historyData?.data ?? []

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4 space-y-5">
        <SectionHeader title="Scan QR" subtitle="Redeem SNICKERS pack codes" />

        {/* Brand strip */}
        <div className="snickers-strip h-1 rounded-full" />

        {/* Hero card */}
        <div className="relative bg-gradient-to-br from-red-950/70 via-surface-2 to-yellow-950/35 border border-red-700/40 rounded-3xl p-6 flex flex-col items-center gap-4 overflow-hidden">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #C8102E 0, #C8102E 1px, transparent 0, transparent 50%)',
              backgroundSize: '10px 10px',
            }}
          />
          <div className="absolute left-5 top-5 rounded-full bg-blue-950/80 px-3 py-1 text-[10px] font-display font-900 uppercase tracking-[0.18em] text-white">
            SNICKERS
          </div>
          <div className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-black">
            <Sparkles size={15} />
          </div>

          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative z-10 mt-4"
          >
            <div className="w-20 h-20 rounded-2xl bg-red-600/20 border-2 border-red-500/30 flex items-center justify-center">
              <QrCode size={40} className="text-red-400" />
            </div>
          </motion.div>

          <div className="relative z-10 text-center">
            <h3 className="font-display font-900 text-xl uppercase text-red-200">SNICKERS Pack QR</h3>
            <p className="text-xs text-red-200/75 mt-1">Scan the code from SNICKERS Kazakhstan packs</p>
          </div>

          {/* Single scan button — uses Telegram native scanner */}
          <button
            type="button"
            onClick={handleNativeScan}
            disabled={isPending}
            className="relative z-10 flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-display text-sm font-900 uppercase text-black active:scale-95 transition-transform disabled:opacity-50"
          >
            <Camera size={16} />
            Scan QR Code
          </button>

          <p className="relative z-10 text-[10px] text-red-300/50 font-display uppercase tracking-wider">
            Opens Telegram camera scanner
          </p>
        </div>

        {/* Success state */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle size={20} className="text-green-400 flex-shrink-0" />
                <div>
                  <p className="font-display font-800 text-sm uppercase text-green-400">
                    {REWARD_LABELS[result.rewardType]?.icon} {REWARD_LABELS[result.rewardType]?.label}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">{result.message}</p>
                </div>
              </div>
              {result.rewardValue > 0 && (
                <p className={`font-display font-900 text-2xl ${REWARD_LABELS[result.rewardType]?.color}`}>
                  +{result.rewardValue}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual code input — shown when native scanner unavailable OR user wants to type */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-display uppercase text-gray-400">
              Enter Pack Code Manually
            </label>
            {!showManual && (
              <button
                onClick={() => setShowManual((v) => !v)}
                className="text-[10px] font-display uppercase text-gray-500 hover:text-brand transition-colors"
              >
                Type instead →
              </button>
            )}
          </div>

          <AnimatePresence>
            {showManual && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); setResult(null) }}
                    onKeyDown={(e) => e.key === 'Enter' && code.trim() && redeem(undefined)}
                    placeholder="SNICKERS-XXXX-XXXX"
                    className="flex-1 bg-surface-3 border border-white/8 rounded-xl px-3 py-3 font-mono text-sm uppercase tracking-widest focus:outline-none focus:border-brand transition-colors placeholder:text-gray-600 placeholder:normal-case placeholder:tracking-normal"
                  />
                  <button
                    onClick={() => redeem(undefined)}
                    disabled={!code.trim() || isPending}
                    className="bg-brand text-black font-display font-800 uppercase px-4 py-3 rounded-xl disabled:opacity-40 active:scale-95 transition-transform"
                  >
                    {isPending ? <LoadingSpinner size={18} /> : <Scan size={20} />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="flex items-center gap-2 mt-2">
              <XCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Demo codes for testing */}
        <div className="bg-surface-2 border border-white/6 rounded-2xl p-3">
          <p className="text-[10px] font-display uppercase text-gray-500 mb-2">Test pack codes (demo):</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_CODES.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCode(c)
                  setError('')
                  setResult(null)
                  setShowManual(true)
                }}
                className="font-mono text-[10px] bg-surface-3 border border-white/8 px-2 py-1 rounded-lg text-gray-300 hover:border-brand/50 hover:text-brand transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Redemption history */}
        {history.length > 0 && (
          <div>
            <h3 className="font-display font-800 text-sm uppercase text-gray-400 mb-2">Redemption History</h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((h: any) => {
                const cfg = REWARD_LABELS[h.rewardType]
                return (
                  <div key={h.id} className="flex items-center gap-3 bg-surface-2 border border-white/6 rounded-xl px-3 py-2.5">
                    <span className="text-lg">{cfg?.icon ?? '🎁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-700 text-sm truncate">{cfg?.label ?? h.rewardType}</p>
                      <p className="text-[10px] text-gray-500">
                        {h.code?.code} · {new Date(h.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {h.rewardValue > 0 && (
                      <span className={`font-display font-800 text-sm ${cfg?.color ?? 'text-brand'}`}>
                        +{h.rewardValue}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}