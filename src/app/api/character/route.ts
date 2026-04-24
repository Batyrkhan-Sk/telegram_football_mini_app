import { NextRequest, NextResponse } from 'next/server'
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

    return NextResponse.json({
      data: {
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
      },
    })
  } catch (err) {
    console.error('[character POST]', err)
    return NextResponse.json({ error: 'Failed to save character' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const telegramId = searchParams.get('telegramId')
  if (!telegramId) return NextResponse.json({ error: 'required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) return NextResponse.json({ data: null })

  const character = await prisma.character.findFirst({ where: { userId: user.id } })
  if (!character) return NextResponse.json({ data: null })

  return NextResponse.json({
    data: {
      ...character,
      stats: {
        speed: character.speed,
        shot: character.shot,
        dribbling: character.dribbling,
        physical: character.physical,
        defense: character.defense,
      },
      createdAt: character.createdAt.toISOString(),
    },
  })
}
