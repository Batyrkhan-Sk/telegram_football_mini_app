'use client'

import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import * as lorelei from '@dicebear/lorelei'
import {
  Camera,
  Check,
  ImagePlus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Wand2,
} from 'lucide-react'
import { useUserStore, useCharacterStore } from '@/store'
import { BottomNav } from '@/components/BottomNav'
import { StatBar, SectionHeader, LoadingSpinner } from '@/components/ui'
import { hapticFeedback } from '@/lib/telegram'
import type { CharacterDraft } from '@/store'
import type { Character } from '@/types'

type SourceMode = 'preset' | 'photo'
type GenerationState = 'idle' | 'analyzing' | 'reconstructing' | 'ready'

interface IdentityProfile {
  source: SourceMode
  seed: number
  confidence: number
  faceShape: string
  featureFocus: string
  colorNote: string
}

// ─── Static data (unchanged from original) ───────────────────────────────────

const HAIRSTYLES = [
  { id: 'style1', label: 'Buzz Cut',  description: 'Clean silhouette' },
  { id: 'style2', label: 'Mohawk',    description: 'Tall center shape' },
  { id: 'style3', label: 'Waves',     description: 'Soft movement' },
  { id: 'style4', label: 'Afro',      description: 'Rounded volume' },
]

const FACE_TYPES = [
  { id: 'face1', label: 'Sharp', description: 'Angular jaw' },
  { id: 'face2', label: 'Cool',  description: 'Balanced oval' },
  { id: 'face3', label: 'Fierce', description: 'Strong brow' },
  { id: 'face4', label: 'Calm',  description: 'Soft cheeks' },
]

const SKIN_TONES = [
  { id: 'tone1', hex: '#FDDBB4', label: 'Fair',   dicebear: 'light' },
  { id: 'tone2', hex: '#C68642', label: 'Medium',  dicebear: 'brown' },
  { id: 'tone3', hex: '#8D5524', label: 'Tan',     dicebear: 'darkBrown' },
  { id: 'tone4', hex: '#4A2315', label: 'Deep',    dicebear: 'dark' },
]

const JERSEY_STYLES = [
  { id: 'jersey1', label: 'Kairat Classic',   color: '#F5C518' },
  { id: 'jersey2', label: 'Away White',        color: '#EEEEEE' },
  { id: 'jersey3', label: 'Third Black',       color: '#222222' },
  { id: 'jersey4', label: 'Special Edition',  color: '#C8102E' },
]

const DOMINANT_ATTRS = [
  { id: 'speed',    label: 'Speed',    desc: 'Fastest on the pitch' },
  { id: 'shot',     label: 'Shot',     desc: 'Clinical finisher' },
  { id: 'dribbling',label: 'Dribbling',desc: 'Skill creator' },
  { id: 'physical', label: 'Physical', desc: 'Power forward' },
  { id: 'defense',  label: 'Defense',  desc: 'Rock solid' },
]

const PRESETS = [
  {
    id: 'academy',
    label: 'Academy Ace',
    description: 'Bright, quick, youthful striker profile',
    draft: { hairstyle: 'style1', faceType: 'face2', skinTone: 'tone2', jerseyStyle: 'jersey1', dominantAttr: 'speed' },
  },
  {
    id: 'captain',
    label: 'Club Captain',
    description: 'Composed leader with balanced features',
    draft: { hairstyle: 'style3', faceType: 'face4', skinTone: 'tone3', jerseyStyle: 'jersey3', dominantAttr: 'defense' },
  },
  {
    id: 'finisher',
    label: 'Final Boss',
    description: 'Bold silhouette and attacking identity',
    draft: { hairstyle: 'style2', faceType: 'face3', skinTone: 'tone4', jerseyStyle: 'jersey4', dominantAttr: 'shot' },
  },
] as const

const ATTR_STATS: Record<string, Record<string, number>> = {
  speed:     { speed: 82, shot: 65, dribbling: 75, physical: 60, defense: 55 },
  shot:      { speed: 68, shot: 84, dribbling: 70, physical: 62, defense: 52 },
  dribbling: { speed: 72, shot: 68, dribbling: 86, physical: 58, defense: 55 },
  physical:  { speed: 65, shot: 62, dribbling: 60, physical: 85, defense: 72 },
  defense:   { speed: 60, shot: 52, dribbling: 58, physical: 75, defense: 85 },
}

// ─── DiceBear draft → option mappers ─────────────────────────────────────────

/**
 * Maps the user's draft to avataaars options.
 * avataaars supports: skinColor, top (hair), facialHair, clothesColor, eyes, eyebrows, mouth
 * We map only what we expose in the UI; the rest DiceBear fills from the seed.
 */
function draftToAvataaarsOptions(draft: CharacterDraft, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f8d25c', // fair
    tone2: 'ae5d29', // medium
    tone3: '694d3d', // tan
    tone4: '3b1f1f', // deep
  }

  // avataaars "top" (hair) values — deterministic choices per our hairstyle IDs
  const topMap: Record<string, string> = {
    style1: 'shortHair',       // buzz/short
    style2: 'frizzle',         // wild / mohawk-ish
    style3: 'wavyBob',         // waves
    style4: 'bigHair',         // afro volume
  }

  // eyes differ per face type to give distinct "expressions"
  const eyesMap: Record<string, string> = {
    face1: 'squint',    // sharp / angular → narrowed
    face2: 'happy',     // cool / balanced → friendly
    face3: 'wink',      // fierce          → intense
    face4: 'default',   // calm / soft     → neutral
  }

  const eyebrowsMap: Record<string, string> = {
    face1: 'angryNatural',
    face2: 'defaultNatural',
    face3: 'raisedExcited',
    face4: 'flatNatural',
  }

  // jersey colour → closest avataaars clothes colour (hex without #)
  const jerseyColorMap: Record<string, string> = {
    jersey1: 'f5c518', // kairat yellow
    jersey2: 'eeeeee', // white
    jersey3: '222222', // black
    jersey4: 'c8102e', // red
  }

  return {
    seed,
    skinColor:    [skinMap[draft.skinTone]    ?? 'ae5d29'],
    top:          [topMap[draft.hairstyle]    ?? 'shortHair'],
    eyes:         [eyesMap[draft.faceType]    ?? 'default'],
    eyebrows:     [eyebrowsMap[draft.faceType] ?? 'defaultNatural'],
    clothesColor: [jerseyColorMap[draft.jerseyStyle] ?? 'f5c518'],
    // sport accessories
    accessories:  ['prescription02'],
    facialHair:   [],
    backgroundColor: ['transparent'],
  }
}

/**
 * Maps draft to lorelei options (used in anime mode).
 * lorelei is a clean, illustrated style that reads as anime-adjacent.
 */
function draftToLoreleiOptions(draft: CharacterDraft, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f9c9b6',
    tone2: 'd08b5b',
    tone3: 'ae5d29',
    tone4: '694d3d',
  }

  const hairColorMap: Record<string, string> = {
    style1: 'f5c518', // yellow / gold
    style2: 'c8102e', // red
    style3: '38bdf8', // blue
    style4: '7c3aed', // violet
  }

  return {
    seed,
    skinColor:       [skinMap[draft.skinTone]     ?? 'd08b5b'],
    hairColor:       [hairColorMap[draft.hairstyle] ?? 'f5c518'],
    backgroundColor: ['transparent'],
  }
}

// ─── Avatar component ─────────────────────────────────────────────────────────

/**
 * Renders a DiceBear SVG avatar as an <img> tag.
 * Uses avataaars in standard mode and lorelei in anime mode.
 * The seed is derived from the user's nickname + draft fingerprint so the
 * avatar is deterministic and personal.
 */
function DiceBearAvatar({
  draft,
  animeMode,
  size = 160,
}: {
  draft: CharacterDraft
  animeMode: boolean
  size?: number
}) {
  const dataUri = useMemo(() => {
    // Build a stable seed string from the user's choices
    const seed = `${draft.nickname || 'kairat'}-${draft.hairstyle}-${draft.faceType}-${draft.skinTone}-${draft.jerseyStyle}`

    if (animeMode) {
      const avatar = createAvatar(lorelei as unknown as Parameters<typeof createAvatar>[0], draftToLoreleiOptions(draft, seed))
      return avatar.toDataUri()
    }

    const avatar = createAvatar(avataaars as unknown as Parameters<typeof createAvatar>[0], draftToAvataaarsOptions(draft, seed))
    return avatar.toDataUri()
  }, [draft, animeMode])

  return (
    <motion.img
      key={`${animeMode}-${draft.hairstyle}-${draft.faceType}-${draft.skinTone}-${draft.jerseyStyle}`}
      src={dataUri}
      alt="Player avatar"
      width={size}
      height={size}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="select-none"
      style={{ imageRendering: 'auto' }}
    />
  )
}

// ─── AvatarPreview card ───────────────────────────────────────────────────────

function AvatarPreview({
  draft,
  animeMode,
  photoPreview,
  identity,
}: {
  draft: CharacterDraft
  animeMode: boolean
  photoPreview: string | null
  identity: IdentityProfile | null
}) {
  const face = FACE_TYPES.find((f) => f.id === draft.faceType)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative overflow-hidden rounded-2xl border p-5 ${
        animeMode ? 'border-violet-400/40' : 'border-brand/35'
      }`}
      style={{
        background: animeMode
          ? 'linear-gradient(145deg, #100E18, #050505 62%)'
          : 'linear-gradient(145deg, #101310, #050505 62%)',
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-x-0 top-0 h-24 bg-brand/10" />
        {animeMode && (
          <div className="absolute right-0 top-0 h-28 w-28 bg-violet-500/15 blur-3xl" />
        )}
      </div>

      <div className="relative z-10 grid grid-cols-[92px_1fr] gap-4 items-center">
        {/* Left column: photo reference thumbnail */}
        <div className="space-y-2">
          <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-surface-3">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Uploaded reference"
                className="h-full w-full object-cover opacity-85"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UserRound className="text-gray-500" size={34} />
              </div>
            )}
          </div>
          <div className="rounded-full bg-white/5 px-2 py-1 text-center text-[9px] uppercase text-gray-400">
            {identity?.source === 'photo' ? 'Reference' : 'Preset'}
          </div>
        </div>

        {/* Right column: DiceBear avatar + nickname */}
        <div className="flex min-h-[250px] flex-col items-center justify-center gap-4">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <DiceBearAvatar draft={draft} animeMode={animeMode} size={180} />
          </motion.div>

          <div className="flex items-center gap-2 rounded-full bg-black/30 px-4 py-2">
            <span className="text-[11px] font-800 uppercase tracking-[0.16em]">
              {draft.nickname || 'Your Hero'}
            </span>
            <span className="text-[10px] text-gray-400">{face?.label}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function pickBySeed<T>(items: T[], seed: number, offset = 0) {
  return items[(seed + offset) % items.length]
}

function buildIdentityProfile(
  source: SourceMode,
  seed: number,
  colorNote = 'warm neutral palette',
): IdentityProfile {
  const faceShape = pickBySeed(['oval', 'angular', 'round', 'long'], seed, 1)
  const featureFocus = pickBySeed(
    ['brow line', 'cheek shape', 'hair silhouette', 'eye spacing'],
    seed,
    2,
  )
  return { source, seed, confidence: 76 + (seed % 18), faceShape, featureFocus, colorNote }
}

function draftFromSeed(seed: number): Partial<CharacterDraft> {
  return {
    hairstyle:     pickBySeed(HAIRSTYLES, seed, 1).id,
    faceType:      pickBySeed(FACE_TYPES, seed, 2).id,
    skinTone:      pickBySeed(SKIN_TONES, seed, 3).id,
    jerseyStyle:   pickBySeed(JERSEY_STYLES, seed, 4).id,
    dominantAttr:  pickBySeed(DOMINANT_ATTRS, seed, 5).id,
  }
}

async function analyzeImage(
  file: File,
): Promise<{ seed: number; preview: string; colorNote: string; toneId: string }> {
  const preview = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = preview
  })
  const canvas = document.createElement('canvas')
  const size = 32
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  context?.drawImage(image, 0, 0, size, size)
  const pixels = context?.getImageData(0, 0, size, size).data
  let red = 0, green = 0, blue = 0, count = 0
  if (pixels) {
    for (let i = 0; i < pixels.length; i += 4) {
      red += pixels[i]; green += pixels[i + 1]; blue += pixels[i + 2]; count += 1
    }
  }
  red   = Math.round(red   / Math.max(count, 1))
  green = Math.round(green / Math.max(count, 1))
  blue  = Math.round(blue  / Math.max(count, 1))
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const toneId =
    luminance > 185 ? 'tone1' : luminance > 135 ? 'tone2' : luminance > 90 ? 'tone3' : 'tone4'
  const colorNote = red > blue ? 'warm facial palette' : 'cool balanced palette'
  const seed = hashString(
    `${file.name}-${file.size}-${file.lastModified}-${red}-${green}-${blue}-${image.width}-${image.height}`,
  )
  return { seed, preview, colorNote, toneId }
}

// ─── Shared UI atoms (unchanged) ─────────────────────────────────────────────

function TraitButton({
  label,
  active,
  children,
  onClick,
}: {
  label: string
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[74px] rounded-xl border p-3 text-left transition-all ${
        active
          ? 'border-brand bg-brand/15 ring-1 ring-brand'
          : 'border-white/8 bg-surface-3'
      }`}
    >
      {children}
      <p className="mt-2 text-[11px] font-display font-800 uppercase">{label}</p>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CharacterPage() {
  const { user }                              = useUserStore()
  const { draft, updateDraft, setSavedCharacter } = useCharacterStore()
  const qc                                    = useQueryClient()
  const [sourceMode, setSourceMode]           = useState<SourceMode>('preset')
  const [selectedPreset, setSelectedPreset]   = useState<string>(PRESETS[0].id)
  const [generationState, setGenerationState] = useState<GenerationState>('ready')
  const [photoPreview, setPhotoPreview]       = useState<string | null>(null)
  const [identity, setIdentity]               = useState<IdentityProfile | null>(
    buildIdentityProfile('preset', 12),
  )
  const [saved, setSaved]         = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const { data: existingData } = useQuery<{ data: Character | null }>({
    queryKey: ['character', user?.telegramId],
    queryFn: () =>
      fetch(`/api/character?telegramId=${user?.telegramId}`).then((r) => r.json()),
    enabled: !!user?.telegramId,
  })

  useEffect(() => {
    if (existingData?.data && !isHydrated) {
      const { nickname, hairstyle, faceType, skinTone, jerseyStyle, dominantAttr, animeMode } =
        existingData.data
      updateDraft({ nickname, hairstyle, faceType, skinTone, jerseyStyle, dominantAttr, animeMode })
      setSavedCharacter(existingData.data)
      setIsHydrated(true)
    }
  }, [existingData?.data, isHydrated, updateDraft, setSavedCharacter])

  const selectedPresetData = useMemo(
    () => PRESETS.find((p) => p.id === selectedPreset) ?? PRESETS[0],
    [selectedPreset],
  )

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0]
    const seed   = hashString(preset.id)
    setSelectedPreset(preset.id)
    setSourceMode('preset')
    setPhotoPreview(null)
    setIdentity(buildIdentityProfile('preset', seed, preset.description))
    updateDraft(preset.draft)
    hapticFeedback('light')
  }

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSourceMode('photo')
    setGenerationState('analyzing')
    setPhotoPreview(null)
    try {
      const analyzed = await analyzeImage(file)
      setPhotoPreview(analyzed.preview)
      setIdentity(buildIdentityProfile('photo', analyzed.seed, analyzed.colorNote))
      updateDraft({ ...draftFromSeed(analyzed.seed), skinTone: analyzed.toneId })
      hapticFeedback('medium')
      window.setTimeout(() => setGenerationState('reconstructing'), 450)
      window.setTimeout(() => { setGenerationState('ready'); hapticFeedback('success') }, 1100)
    } catch (error) {
      console.error(error)
      setGenerationState('idle')
    }
  }

  const regenerateVariant = () => {
    const seed = (identity?.seed ?? 10) + 17
    setIdentity((current) =>
      current
        ? { ...current, seed, confidence: 74 + (seed % 20) }
        : buildIdentityProfile(sourceMode, seed),
    )
    updateDraft(draftFromSeed(seed))
    hapticFeedback('light')
  }

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

  const isGenerating =
    generationState === 'analyzing' || generationState === 'reconstructing'

  // ── Saved confirmation screen ────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 pb-24 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15">
            <ShieldCheck className="text-brand" size={34} />
          </div>
          <h1 className="font-display text-3xl font-900 uppercase text-brand">Player Saved</h1>
          <p className="mt-2 text-sm text-gray-400">
            Your character identity is ready for the pitch.
          </p>
        </motion.div>

        <AvatarPreview
          draft={draft}
          animeMode={draft.animeMode}
          photoPreview={photoPreview}
          identity={identity}
        />

        <div className="w-full rounded-2xl border border-white/8 bg-surface-2 p-4">
          {Object.entries(ATTR_STATS[draft.dominantAttr] ?? {}).map(([stat, value]) => (
            <StatBar key={stat} label={stat} value={value} />
          ))}
        </div>

        <button
          onClick={() => setSaved(false)}
          className="w-full rounded-2xl bg-brand py-3.5 font-display font-800 uppercase text-black"
        >
          Edit Character
        </button>
        <BottomNav />
      </div>
    )
  }

  // ── Main editor ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col pb-24">
      <div className="px-4 pt-4">
        <SectionHeader
          title="Create Player"
          subtitle="Choose a base, generate a look, refine the details"
        />

        {/* Nickname */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[11px] font-display uppercase text-gray-400">
            Nickname
          </label>
          <input
            type="text"
            value={draft.nickname}
            onChange={(e) => updateDraft({ nickname: e.target.value })}
            placeholder="Your player name..."
            maxLength={20}
            className="w-full rounded-xl border border-white/8 bg-surface-3 px-3 py-2.5 font-display text-base font-700 uppercase tracking-wide placeholder:text-gray-600 focus:border-brand focus:outline-none"
          />
        </div>

        {/* Source mode toggle */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => applyPreset(selectedPreset)}
            className={`flex items-center justify-center gap-2 rounded-xl border py-3 font-display font-800 uppercase ${
              sourceMode === 'preset'
                ? 'border-brand bg-brand/15 text-brand'
                : 'border-white/8 bg-surface-3 text-gray-400'
            }`}
          >
            <UserRound size={16} />
            Presets
          </button>
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border py-3 font-display font-800 uppercase ${
              sourceMode === 'photo'
                ? 'border-brand bg-brand/15 text-brand'
                : 'border-white/8 bg-surface-3 text-gray-400'
            }`}
          >
            <Upload size={16} />
            Photo
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
        </div>

        {/* Preset list / photo info */}
        <AnimatePresence mode="wait">
          {sourceMode === 'preset' ? (
            <motion.div
              key="presets"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 grid gap-2"
            >
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedPresetData.id === preset.id
                      ? 'border-brand bg-brand/15'
                      : 'border-white/8 bg-surface-3'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Inline DiceBear thumbnail for each preset */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/20 overflow-hidden">
                      <DiceBearAvatar
                        draft={{ ...draft, ...preset.draft }}
                        animeMode={false}
                        size={40}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-800 uppercase">{preset.label}</p>
                      <p className="text-xs text-gray-400">{preset.description}</p>
                    </div>
                    {selectedPresetData.id === preset.id && (
                      <Check size={16} className="text-brand" />
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="photo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 rounded-2xl border border-white/8 bg-surface-2 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
                  {photoPreview ? (
                    <Camera size={20} className="text-brand" />
                  ) : (
                    <ImagePlus size={20} className="text-brand" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-display font-800 uppercase">Photo to Character</p>
                  <p className="text-xs text-gray-400">
                    Upload a clear face photo. The same image keeps the same identity seed.
                  </p>
                </div>
                <label className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-display font-800 uppercase">
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Anime mode toggle */}
        <button
          onClick={() => updateDraft({ animeMode: !draft.animeMode })}
          className={`mb-4 flex w-full items-center gap-2 rounded-xl border px-3 py-3 transition-all ${
            draft.animeMode
              ? 'border-violet-400 bg-violet-500/15 text-violet-200'
              : 'border-white/8 bg-surface-3 text-gray-300'
          }`}
        >
          <Sparkles size={16} />
          <span className="font-display font-800 uppercase">Anime Mode</span>
          <span className="ml-auto text-xs text-gray-400">
            {draft.animeMode ? 'Lorelei illustrated style' : 'Avataaars sport style'}
          </span>
          <div
            className={`h-5 w-9 rounded-full ${draft.animeMode ? 'bg-violet-500' : 'bg-surface-1'}`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white transition-transform ${
                draft.animeMode ? 'translate-x-4' : ''
              }`}
            />
          </div>
        </button>

        {/* Avatar preview */}
        <div className="mb-4">
          <AvatarPreview
            draft={draft}
            animeMode={draft.animeMode}
            photoPreview={photoPreview}
            identity={identity}
          />
        </div>

        {/* Identity controls */}
        <div className="mb-4 rounded-2xl border border-white/8 bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-brand" />
            <h3 className="font-display font-800 uppercase">Identity Controls</h3>
            <button
              onClick={regenerateVariant}
              className="ml-auto flex items-center gap-1 rounded-lg bg-white/8 px-2 py-1 text-[10px] font-display font-800 uppercase"
            >
              <RefreshCw size={12} />
              Variant
            </button>
          </div>

          {isGenerating ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface-3 px-3 py-3">
              <LoadingSpinner size={16} />
              <div>
                <p className="text-sm font-display font-800 uppercase">
                  {generationState === 'analyzing'
                    ? 'Analyzing facial anchors'
                    : 'Reconstructing character style'}
                </p>
                <p className="text-xs text-gray-400">
                  Preserving silhouette, tone, and distinguishing feature cues.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-3 p-2">
                <p className="text-[10px] uppercase text-gray-400">Match</p>
                <p className="font-display text-lg font-900 text-brand">
                  {identity?.confidence ?? 80}%
                </p>
              </div>
              <div className="rounded-xl bg-surface-3 p-2">
                <p className="text-[10px] uppercase text-gray-400">Shape</p>
                <p className="font-display text-sm font-800 uppercase">
                  {identity?.faceShape ?? 'oval'}
                </p>
              </div>
              <div className="rounded-xl bg-surface-3 p-2">
                <p className="text-[10px] uppercase text-gray-400">Anchor</p>
                <p className="font-display text-sm font-800 uppercase">
                  {identity?.featureFocus ?? 'brow'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Trait editors — all unchanged */}
        <div className="mb-4 space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-display font-800 uppercase text-gray-400">
              Hairstyle
            </p>
            <div className="grid grid-cols-2 gap-2">
              {HAIRSTYLES.map((option) => (
                <TraitButton
                  key={option.id}
                  label={option.label}
                  active={draft.hairstyle === option.id}
                  onClick={() => updateDraft({ hairstyle: option.id })}
                >
                  <p className="text-xs text-gray-400">{option.description}</p>
                </TraitButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-display font-800 uppercase text-gray-400">
              Face Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FACE_TYPES.map((option) => (
                <TraitButton
                  key={option.id}
                  label={option.label}
                  active={draft.faceType === option.id}
                  onClick={() => updateDraft({ faceType: option.id })}
                >
                  <p className="text-xs text-gray-400">{option.description}</p>
                </TraitButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-display font-800 uppercase text-gray-400">
              Skin Tone
            </p>
            <div className="grid grid-cols-4 gap-2">
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => updateDraft({ skinTone: tone.id })}
                  className={`rounded-xl border p-2 ${
                    draft.skinTone === tone.id
                      ? 'border-brand ring-1 ring-brand'
                      : 'border-white/8 bg-surface-3'
                  }`}
                >
                  <div
                    className="mx-auto h-9 w-9 rounded-full border-2 border-white/20"
                    style={{ background: tone.hex }}
                  />
                  <p className="mt-1 text-[10px] font-display font-700 uppercase">{tone.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-display font-800 uppercase text-gray-400">
              Jersey
            </p>
            <div className="grid grid-cols-2 gap-2">
              {JERSEY_STYLES.map((jersey) => (
                <TraitButton
                  key={jersey.id}
                  label={jersey.label}
                  active={draft.jerseyStyle === jersey.id}
                  onClick={() => updateDraft({ jerseyStyle: jersey.id })}
                >
                  <div
                    className="h-8 w-12 rounded-lg border border-white/20"
                    style={{ background: jersey.color }}
                  />
                </TraitButton>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-display font-800 uppercase text-gray-400">
              Dominant Attribute
            </p>
            <div className="space-y-2">
              {DOMINANT_ATTRS.map((attr) => (
                <button
                  key={attr.id}
                  onClick={() => updateDraft({ dominantAttr: attr.id })}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
                    draft.dominantAttr === attr.id
                      ? 'border-brand bg-brand/15'
                      : 'border-white/8 bg-surface-3'
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/20 text-xs font-display font-900 uppercase text-brand">
                    {attr.label.slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <p className="font-display font-800 uppercase">{attr.label}</p>
                    <p className="text-xs text-gray-400">{attr.desc}</p>
                  </div>
                  {draft.dominantAttr === attr.id && <Check size={16} className="text-brand" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={() => saveCharacter()}
          disabled={!draft.nickname.trim() || isPending || isGenerating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display font-900 uppercase text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? <LoadingSpinner size={18} /> : <><Check size={16} /> Save Player</>}
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
