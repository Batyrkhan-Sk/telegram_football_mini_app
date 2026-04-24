import { NextRequest, NextResponse } from 'next/server'
import type { Character as PrismaCharacter } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const CharacterSchema = z.object({
  telegramId: z.string(),
  nickname: z.string().min(2).max(20),
  hairstyle: z.string(),
  faceType: z.string(),
  skinTone: z.string(),
  jerseyStyle: z.string(),
  dominantAttr: z.string(),
  animeMode: z.boolean().optional(),
})

const ATTR_STAT_MAP: Record<string, Record<string, number>> = {
  speed:    { speed: 82, shot: 65, dribbling: 75, physical: 60, defense: 55 },
  shot:     { speed: 68, shot: 84, dribbling: 70, physical: 62, defense: 52 },
  dribbling:{ speed: 72, shot: 68, dribbling: 86, physical: 58, defense: 55 },
  physical: { speed: 65, shot: 62, dribbling: 60, physical: 85, defense: 72 },
  defense:  { speed: 60, shot: 52, dribbling: 58, physical: 75, defense: 85 },
}

const ATTR_POSITION_MAP: Record<string, 'FWD' | 'MID' | 'DEF'> = {
  speed: 'FWD',
  shot: 'FWD',
  dribbling: 'MID',
  physical: 'DEF',
  defense: 'DEF',
}

function formatCharacter(character: PrismaCharacter) {
  return {
    ...character,
    stats: {
      speed: character.speed,
      shot: character.shot,
      dribbling: character.dribbling,
      physical: character.physical,
      defense: character.defense,
    },
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = CharacterSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { telegramId: input.telegramId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stats = ATTR_STAT_MAP[input.dominantAttr] ?? ATTR_STAT_MAP.speed

    // Upsert — one character per user for MVP
    const existing = await prisma.character.findFirst({ where: { userId: user.id } })

    let character
    if (existing) {
      character = await prisma.character.update({
        where: { id: existing.id },
        data: {
          nickname: input.nickname,
          hairstyle: input.hairstyle,
          faceType: input.faceType,
          skinTone: input.skinTone,
          jerseyStyle: input.jerseyStyle,
          dominantAttr: input.dominantAttr,
          animeMode: input.animeMode ?? false,
          ...stats,
        },
      })
    } else {
      character = await prisma.character.create({
        data: {
          userId: user.id,
          nickname: input.nickname,
          hairstyle: input.hairstyle,
          faceType: input.faceType,
          skinTone: input.skinTone,
          jerseyStyle: input.jerseyStyle,
          dominantAttr: input.dominantAttr,
          animeMode: input.animeMode ?? false,
          ...stats,
        },
      })
    }

    const customCardId = `character-card-${user.id}`
    await prisma.card.upsert({
      where: { id: customCardId },
      update: {
        playerName: input.nickname,
        rarity: 'RARE',
        club: 'Custom Player',
        position: ATTR_POSITION_MAP[input.dominantAttr] ?? 'FWD',
        imageUrl: '',
        isCustom: true,
        speed: stats.speed,
        shot: stats.shot,
        dribbling: stats.dribbling,
        physical: stats.physical,
        defense: stats.defense,
      },
      create: {
        id: customCardId,
        playerName: input.nickname,
        rarity: 'RARE',
        club: 'Custom Player',
        position: ATTR_POSITION_MAP[input.dominantAttr] ?? 'FWD',
        imageUrl: '',
        isCustom: true,
        speed: stats.speed,
        shot: stats.shot,
        dribbling: stats.dribbling,
        physical: stats.physical,
        defense: stats.defense,
      },
    })

    await prisma.userCard.upsert({
      where: { userId_cardId: { userId: user.id, cardId: customCardId } },
      update: {},
      create: {
        userId: user.id,
        cardId: customCardId,
        energy: 100,
        maxEnergy: 100,
      },
    })

    return NextResponse.json({ data: formatCharacter(character) })
  } catch (err) {
    console.error('[character POST]', err)
    return NextResponse.json({ error: 'Failed to save character' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const telegramId = searchParams.get('telegramId')
  const id = searchParams.get('id')

  if (id) {
    const character = await prisma.character.findUnique({ where: { id } })
    if (!character) return NextResponse.json({ data: null })
    return NextResponse.json({ data: formatCharacter(character) })
  }

  if (!telegramId) return NextResponse.json({ error: 'required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) return NextResponse.json({ data: null })

  const character = await prisma.character.findFirst({ where: { userId: user.id } })
  if (!character) return NextResponse.json({ data: null })

  return NextResponse.json({ data: formatCharacter(character) })
}
