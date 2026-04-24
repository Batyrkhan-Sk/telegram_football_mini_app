'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, Sparkles, User2 } from 'lucide-react'
import { useUserStore, useCharacterStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { StatBar, SectionHeader, LoadingSpinner, Badge } from '@/components/ui'
import { hapticFeedback } from '@/lib/telegram'
import type { Character } from '@/types'

// ─── Asset options ──────────────────────────────────────────────────────────────

const HAIRSTYLES = [
  { id: 'style1', label: 'Buzz Cut', emoji: '💈' },
  { id: 'style2', label: 'Mohawk', emoji: '🔥' },
  { id: 'style3', label: 'Waves', emoji: '🌊' },
  { id: 'style4', label: 'Afro', emoji: '⭕' },
]

const FACE_TYPES = [
  { id: 'face1', label: 'Sharp', emoji: '😤' },
  { id: 'face2', label: 'Cool', emoji: '😎' },
  { id: 'face3', label: 'Fierce', emoji: '😠' },
  { id: 'face4', label: 'Calm', emoji: '🧘' },
]

const SKIN_TONES = [
  { id: 'tone1', hex: '#FDDBB4', label: 'Fair' },
  { id: 'tone2', hex: '#C68642', label: 'Medium' },
  { id: 'tone3', hex: '#8D5524', label: 'Tan' },
  { id: 'tone4', hex: '#4A2315', label: 'Deep' },
]

const JERSEY_STYLES = [
  { id: 'jersey1', label: 'Kairat Classic', color: '#F5C518' },
  { id: 'jersey2', label: 'Away White', color: '#EEEEEE' },
  { id: 'jersey3', label: 'Third Black', color: '#222222' },
  { id: 'jersey4', label: 'Special Edition', color: '#C8102E' },
]

const DOMINANT_ATTRS = [
  { id: 'speed', label: 'Speed', emoji: '⚡', desc: 'Fastest on the pitch' },
  { id: 'shot', label: 'Shot', emoji: '🎯', desc: 'Clinical finisher' },
  { id: 'dribbling', label: 'Dribbling', emoji: '🌀', desc: 'Skill merchant' },
  { id: 'physical', label: 'Physical', emoji: '💪', desc: 'Powerhouse' },
  { id: 'defense', label: 'Defense', emoji: '🛡️', desc: 'Rock solid' },
]

const ATTR_STATS: Record<string, Record<string, number>> = {
  speed:    { speed: 82, shot: 65, dribbling: 75, physical: 60, defense: 55 },
  shot:     { speed: 68, shot: 84, dribbling: 70, physical: 62, defense: 52 },
  dribbling:{ speed: 72, shot: 68, dribbling: 86, physical: 58, defense: 55 },
  physical: { speed: 65, shot: 62, dribbling: 60, physical: 85, defense: 72 },
  defense:  { speed: 60, shot: 52, dribbling: 58, physical: 75, defense: 85 },
}

// ─── Avatar preview component ──────────────────────────────────────────────────

function AvatarPreview({ draft, animeMode }: { draft: ReturnType<typeof useCharacterStore>['draft'], animeMode: boolean }) {
  const jersey = JERSEY_STYLES.find((j) => j.id === draft.jerseyStyle)
  const skin = SKIN_TONES.find((s) => s.id === draft.skinTone)
  const attribute = DOMINANT_ATTRS.find((attr) => attr.id === draft.dominantAttr)
  const hairColorMap: Record<string, string> = {
    style1: '#F5C518',
    style2: '#FB7185',
    style3: '#38BDF8',
    style4: '#C084FC',
  }
  const hairColor = hairColorMap[draft.hairstyle] ?? '#F5C518'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: [1, 1.02, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative overflow-hidden rounded-3xl p-6 border ${animeMode ? 'border-purple-500/20' : 'border-yellow-400/20'}`}
      style={{ background: animeMode ? 'radial-gradient(circle at top, rgba(168,85,247,0.18), transparent 45%)' : 'radial-gradient(circle at top, rgba(245,197,24,0.16), transparent 45%)' }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute left-4 top-8 w-16 h-16 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute right-5 top-10 w-12 h-12 rounded-full bg-white/5 blur-2xl" />
        {animeMode &&
          [...Array(5)].map((_, index) => (
            <motion.div
              key={index}
              className="absolute rounded-full bg-white/25"
              style={{ width: 10 + index * 4, height: 10 + index * 4, top: `${15 + index * 12}%`, left: `${10 + (index % 2) * 30}%` }}
              animate={{ opacity: [0.3, 0.9, 0.3], y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }}
            />
          ))}
      </div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 flex flex-col items-center gap-3"
      >
        <div className="relative w-36 h-36 rounded-full shadow-[0_12px_60px_-30px_rgba(0,0,0,0.45)]" style={{ background: '#111827' }}>
          <motion.div
            className="absolute inset-x-8 top-4 h-16 rounded-full"
            style={{ background: hairColor }}
            animate={{ rotate: animeMode ? [2, -2, 2] : [0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute left-1/2 top-12 -translate-x-1/2 w-24 h-24 rounded-full border-4" style={{ background: skin?.hex ?? '#C68642', borderColor: animeMode ? '#A855F7' : '#F5C518' }}>
            <div className="absolute inset-x-0 top-8 flex items-center justify-between px-6">
              <div className="w-3 h-3 rounded-full bg-black" />
              <div className="w-3 h-3 rounded-full bg-black" />
            </div>
            <div className="absolute left-1/2 top-16 -translate-x-1/2 w-8 h-2 rounded-full bg-black/90" />
            <div className="absolute inset-x-0 top-2 flex justify-center">
              <div className="w-10 h-4 rounded-full bg-white/30" />
            </div>
          </div>
          <motion.div
            className="absolute left-4 bottom-8 w-8 h-8 rounded-full bg-white/10"
            animate={{ x: [0, 6, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute right-3 bottom-10 w-5 h-5 rounded-full bg-white/15"
            animate={{ y: [0, -4, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          animate={{ rotate: [-1, 1, -1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-44 h-24 rounded-[32px] overflow-hidden border-4"
          style={{ background: jersey?.color ?? '#F5C518', borderColor: animeMode ? '#A855F7' : '#F5C518' }}
        >
          <div className="absolute inset-x-10 top-4 h-8 rounded-full bg-white/25" />
          <div className="absolute left-10 top-3 w-8 h-8 rounded-full bg-white/50" />
          <div className="absolute right-10 top-3 w-8 h-8 rounded-full bg-white/50" />
        </motion.div>

        <div className="flex items-center gap-2 rounded-full bg-black/20 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white">
          <span className="font-800">{draft.nickname || 'YOUR HERO'}</span>
          <span className={animeMode ? 'text-purple-300' : 'text-yellow-300'}>{attribute?.emoji}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Option grid component ────────────────────────────────────────────────────

function OptionGrid<T extends { id: string; label: string }>({
  options,
  selected,
  onSelect,
  renderOption,
}: {
  options: T[]
  selected: string
  onSelect: (id: string) => void
  renderOption: (opt: T) => React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
            selected === opt.id
              ? 'border-brand bg-brand/15 ring-1 ring-brand'
              : 'border-white/8 bg-surface-3'
          }`}
        >
          {renderOption(opt)}
          <span className="text-[11px] font-display font-700 uppercase">{opt.label}</span>
          {selected === opt.id && <Check size={12} className="text-brand" />}
        </button>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CharacterPage() {
  const { user } = useUserStore()
  const { draft, updateDraft, setSavedCharacter } = useCharacterStore()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const { data: existingData } = useQuery<{ data: Character | null }>({
    queryKey: ['character', user?.telegramId],
    queryFn: () => fetch(`/api/character?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  useEffect(() => {
    if (existingData?.data && !isHydrated) {
      const { nickname, hairstyle, faceType, skinTone, jerseyStyle, dominantAttr, animeMode } = existingData.data
      updateDraft({ nickname, hairstyle, faceType, skinTone, jerseyStyle, dominantAttr, animeMode })
      setSavedCharacter(existingData.data)
      setIsHydrated(true)
    }
  }, [existingData?.data, isHydrated, updateDraft, setSavedCharacter])

  const { mutate: saveCharacter, isPending } = useMutation({
    mutationFn: () =>
      fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: user?.telegramId, ...draft }),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.data) {
        setSavedCharacter(res.data)
        setSaved(true)
        hapticFeedback('success')
        qc.invalidateQueries({ queryKey: ['character'] })
      }
    },
  })

  const steps = [
    {
      title: 'Hairstyle',
      content: (
        <OptionGrid
          options={HAIRSTYLES}
          selected={draft.hairstyle}
          onSelect={(id) => updateDraft({ hairstyle: id })}
          renderOption={(opt) => <span className="text-2xl">{opt.emoji}</span>}
        />
      ),
    },
    {
      title: 'Face Type',
      content: (
        <OptionGrid
          options={FACE_TYPES}
          selected={draft.faceType}
          onSelect={(id) => updateDraft({ faceType: id })}
          renderOption={(opt) => <span className="text-2xl">{opt.emoji}</span>}
        />
      ),
    },
    {
      title: 'Skin Tone',
      content: (
        <div className="grid grid-cols-4 gap-2">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              onClick={() => updateDraft({ skinTone: tone.id })}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                draft.skinTone === tone.id ? 'border-brand ring-1 ring-brand' : 'border-white/8'
              }`}
            >
              <div className="w-10 h-10 rounded-full border-2 border-white/20" style={{ background: tone.hex }} />
              <span className="text-[10px] font-display font-700 uppercase">{tone.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: 'Jersey',
      content: (
        <OptionGrid
          options={JERSEY_STYLES}
          selected={draft.jerseyStyle}
          onSelect={(id) => updateDraft({ jerseyStyle: id })}
          renderOption={(opt) => (
            <div className="w-10 h-8 rounded-lg border-2 border-white/20" style={{ background: opt.color }} />
          )}
        />
      ),
    },
    {
      title: 'Dominant Attribute',
      content: (
        <div className="space-y-2">
          {DOMINANT_ATTRS.map((attr) => (
            <button
              key={attr.id}
              onClick={() => updateDraft({ dominantAttr: attr.id })}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                draft.dominantAttr === attr.id ? 'border-brand bg-brand/15' : 'border-white/8 bg-surface-3'
              }`}
            >
              <span className="text-2xl">{attr.emoji}</span>
              <div className="flex-1 text-left">
                <p className="font-display font-800 text-sm uppercase">{attr.label}</p>
                <p className="text-[10px] text-gray-400">{attr.desc}</p>
              </div>
              {draft.dominantAttr === attr.id && <Check size={16} className="text-brand" />}
            </button>
          ))}
        </div>
      ),
    },
  ]

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
          <div className="text-7xl mb-2">🎉</div>
          <h1 className="font-display font-900 text-3xl uppercase text-brand">Player Created!</h1>
          <p className="text-gray-400 text-sm mt-2">Your custom character is ready to battle.</p>
        </motion.div>
        <AvatarPreview draft={draft} animeMode={draft.animeMode} />
        <div className="w-full bg-surface-2 border border-white/8 rounded-2xl p-4 space-y-2">
          {Object.entries(ATTR_STATS[draft.dominantAttr] ?? {}).map(([stat, val]) => (
            <StatBar key={stat} label={stat} value={val} />
          ))}
        </div>
        <button onClick={() => setSaved(false)} className="w-full bg-brand text-black font-display font-800 uppercase py-3.5 rounded-2xl">
          Edit Character
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <div className="px-4 pt-4">
        <SectionHeader title="Create Player" subtitle="Build your custom character" />
        {existingData?.data && !saved && (
          <p className="text-xs text-gray-400 mb-4">Saved player loaded — edit your anime-style avatar and save to update it.</p>
        )}

        {/* Nickname input */}
        <div className="mb-4">
          <label className="text-[11px] font-display uppercase text-gray-400 block mb-1.5">Nickname</label>
          <input
            type="text"
            value={draft.nickname}
            onChange={(e) => updateDraft({ nickname: e.target.value })}
            placeholder="Your player name..."
            maxLength={20}
            className="w-full bg-surface-3 border border-white/8 rounded-xl px-3 py-2.5 font-display font-700 text-base uppercase tracking-wide focus:outline-none focus:border-brand transition-colors placeholder:text-gray-600"
          />
        </div>

        {/* Anime mode toggle */}
        <button
          onClick={() => updateDraft({ animeMode: !draft.animeMode })}
          className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border transition-all ${
            draft.animeMode ? 'border-purple-500 bg-purple-500/15 text-purple-300' : 'border-white/8 bg-surface-3 text-gray-400'
          }`}
        >
          <Sparkles size={14} />
          <span className="font-display font-700 text-sm uppercase">Anime Mode</span>
          <div className={`ml-auto w-8 h-4 rounded-full transition-all ${draft.animeMode ? 'bg-purple-500' : 'bg-surface-1'}`}>
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${draft.animeMode ? 'translate-x-4' : ''}`} />
          </div>
        </button>

        {/* Avatar preview */}
        <div className="mb-4">
          <AvatarPreview draft={draft} animeMode={draft.animeMode} />
        </div>

        {/* Step content */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-800 text-base uppercase text-gray-300">{steps[step].title}</h3>
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-brand' : 'w-1.5 bg-surface-3'}`} />
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {steps[step].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 bg-surface-3 border border-white/8 font-display font-700 uppercase px-4 py-3 rounded-xl"
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 flex items-center justify-center gap-1 bg-brand text-black font-display font-800 uppercase py-3 rounded-xl"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => saveCharacter()}
              disabled={!draft.nickname.trim() || isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-brand text-black font-display font-800 uppercase py-3 rounded-xl disabled:opacity-40"
            >
              {isPending ? <LoadingSpinner size={18} /> : <><Check size={16} /> Save Player</>}
            </button>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
