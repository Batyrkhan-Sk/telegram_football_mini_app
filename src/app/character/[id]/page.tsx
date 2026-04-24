'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import * as lorelei from '@dicebear/lorelei'
import { Home, ShieldCheck, Swords } from 'lucide-react'
import { BottomNav } from '@/components/BottomNav'
import { LoadingSpinner, StatBar } from '@/components/ui'
import type { Character } from '@/types'
import type { CharacterDraft } from '@/store'

function characterToDraft(character: Character): CharacterDraft {
  return {
    nickname: character.nickname,
    hairstyle: character.hairstyle,
    faceType: character.faceType,
    skinTone: character.skinTone,
    jerseyStyle: character.jerseyStyle,
    dominantAttr: character.dominantAttr,
    animeMode: character.animeMode,
  }
}

function draftToAvatarOptions(draft: CharacterDraft, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f8d25c',
    tone2: 'ae5d29',
    tone3: '694d3d',
    tone4: '3b1f1f',
  }

  const topMap: Record<string, string> = {
    style1: 'shortHair',
    style2: 'frizzle',
    style3: 'wavyBob',
    style4: 'bigHair',
  }

  const eyesMap: Record<string, string> = {
    face1: 'squint',
    face2: 'happy',
    face3: 'wink',
    face4: 'default',
  }

  const eyebrowsMap: Record<string, string> = {
    face1: 'angryNatural',
    face2: 'defaultNatural',
    face3: 'raisedExcited',
    face4: 'flatNatural',
  }

  const jerseyColorMap: Record<string, string> = {
    jersey1: 'f5c518',
    jersey2: 'eeeeee',
    jersey3: '222222',
    jersey4: 'c8102e',
  }

  return {
    seed,
    skinColor: [skinMap[draft.skinTone] ?? 'ae5d29'],
    top: [topMap[draft.hairstyle] ?? 'shortHair'],
    eyes: [eyesMap[draft.faceType] ?? 'default'],
    eyebrows: [eyebrowsMap[draft.faceType] ?? 'defaultNatural'],
    clothesColor: [jerseyColorMap[draft.jerseyStyle] ?? 'f5c518'],
    accessories: ['prescription02'],
    facialHair: [],
    backgroundColor: ['transparent'],
  }
}

function draftToAnimeOptions(draft: CharacterDraft, seed: string) {
  const skinMap: Record<string, string> = {
    tone1: 'f9c9b6',
    tone2: 'd08b5b',
    tone3: 'ae5d29',
    tone4: '694d3d',
  }

  const hairColorMap: Record<string, string> = {
    style1: 'f5c518',
    style2: 'c8102e',
    style3: '38bdf8',
    style4: '7c3aed',
  }

  return {
    seed,
    skinColor: [skinMap[draft.skinTone] ?? 'd08b5b'],
    hairColor: [hairColorMap[draft.hairstyle] ?? 'f5c518'],
    backgroundColor: ['transparent'],
  }
}

function SharedCharacterAvatar({ character }: { character: Character }) {
  const draft = characterToDraft(character)
  const dataUri = useMemo(() => {
    const seed = `${character.id}-${draft.nickname}-${draft.hairstyle}-${draft.faceType}-${draft.skinTone}`
    const avatar = draft.animeMode
      ? createAvatar(lorelei, draftToAnimeOptions(draft, seed) as never)
      : createAvatar(avataaars, draftToAvatarOptions(draft, seed) as never)

    return avatar.toDataUri()
  }, [character, draft])

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUri}
      alt={`${character.nickname} character`}
      width={220}
      height={220}
      className="select-none"
    />
  )
}

export default function SharedCharacterPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const { data, isLoading } = useQuery<{ data: Character | null }>({
    queryKey: ['public-character', id],
    queryFn: () => fetch(`/api/character?id=${id}`).then((res) => res.json()),
    enabled: !!id,
  })

  const character = data?.data

  return (
    <div className="flex min-h-screen flex-col px-4 pb-24 pt-6">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <LoadingSpinner size={28} />
        </div>
      ) : !character ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <ShieldCheck className="text-gray-500" size={42} />
          <h1 className="font-display text-3xl font-900 uppercase">Player Not Found</h1>
          <Link
            href="/"
            className="rounded-2xl bg-brand px-8 py-3 font-display font-800 uppercase text-black"
          >
            Go Home
          </Link>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-5 text-center">
          <div>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15">
              <ShieldCheck className="text-brand" size={30} />
            </div>
            <p className="text-xs font-display font-800 uppercase tracking-[0.2em] text-brand">
              Shared Player
            </p>
            <h1 className="mt-2 font-display text-4xl font-900 uppercase">
              {character.nickname}
            </h1>
          </div>

          <div className="w-full rounded-2xl border border-white/12 bg-surface-1 p-5">
            <div className="flex min-h-[260px] items-center justify-center">
              <SharedCharacterAvatar character={character} />
            </div>
            <div className="mx-auto mt-3 inline-flex rounded-full bg-black/35 px-4 py-2">
              <span className="text-[11px] font-display font-800 uppercase tracking-[0.18em]">
                {character.animeMode ? 'Anime Mode' : 'Club Style'}
              </span>
            </div>
          </div>

          <div className="w-full rounded-2xl border border-white/12 bg-surface-2 p-4">
            {Object.entries(character.stats).map(([stat, value]) => (
              <StatBar key={stat} label={stat} value={value} />
            ))}
          </div>

          <div className="grid w-full grid-cols-2 gap-3">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-surface-2 py-3.5 font-display font-800 uppercase text-white"
            >
              <Home size={16} />
              Home
            </Link>
            <Link
              href="/battle"
              className="flex items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 font-display font-800 uppercase text-black"
            >
              <Swords size={16} />
              Battle
            </Link>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  )
}
