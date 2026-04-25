import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isOnCooldown } from '@/lib/utils'
import { ensureStarterCards } from '@/lib/starter-card'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { telegramId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await ensureStarterCards(user.id)

    const userCards = await prisma.userCard.findMany({
      where: { userId: user.id },
      include: { card: true },
      orderBy: { acquiredAt: 'desc' },
    })

    const character = await prisma.character.findFirst({ where: { userId: user.id } })

    const formatted = userCards.map((uc) => ({
      id: uc.id,
      cardId: uc.cardId,
      card: {
        id: uc.card.id,
        playerName: uc.card.playerName,
        rarity: uc.card.rarity,
        club: uc.card.club,
        position: uc.card.position,
        imageUrl: uc.card.imageUrl,
        isCustom: uc.card.isCustom,
        character: uc.card.isCustom && character ? {
          id: character.id,
          userId: character.userId,
          nickname: character.nickname,
          hairstyle: character.hairstyle,
          faceType: character.faceType,
          skinTone: character.skinTone,
          jerseyStyle: character.jerseyStyle,
          dominantAttr: character.dominantAttr,
          animeMode: character.animeMode,
          stats: {
            speed: character.speed,
            shot: character.shot,
            dribbling: character.dribbling,
            physical: character.physical,
            defense: character.defense,
          },
          createdAt: character.createdAt.toISOString(),
        } : null,
        stats: {
          speed: uc.card.speed,
          shot: uc.card.shot,
          dribbling: uc.card.dribbling,
          physical: uc.card.physical,
          defense: uc.card.defense,
        },
        createdAt: uc.card.createdAt.toISOString(),
      },
      energy: uc.energy,
      maxEnergy: uc.maxEnergy,
      cooldownEndAt: uc.cooldownEndAt?.toISOString() ?? null,
      timesUsed: uc.timesUsed,
      acquiredAt: uc.acquiredAt.toISOString(),
      isExhausted: uc.energy <= 0,
      isOnCooldown: isOnCooldown(uc.cooldownEndAt?.toISOString() ?? null),
    }))

    return NextResponse.json({ data: formatted })
  } catch (err) {
    console.error('[cards GET]', err)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}
