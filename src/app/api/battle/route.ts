import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveSingleBattle, resolveTeamBattle, xpToLevel } from '@/lib/battle/engine'
import { CARD_ENERGY } from '@/config/game'
import type { Card, UserCard } from '@/types'

const BattleSchema = z.object({
  telegramId: z.string(),
  opponentTelegramId: z.string(),
  format: z.enum(['ONE_V_ONE', 'THREE_V_THREE']),
  selectedUserCardIds: z.array(z.string()),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = BattleSchema.parse(body)

    const [player, opponent] = await Promise.all([
      prisma.user.findUnique({
        where: { telegramId: input.telegramId },
        include: { profile: true },
      }),
      prisma.user.findUnique({
        where: { telegramId: input.opponentTelegramId },
        include: { profile: true },
      }),
    ])

    if (!player || !opponent) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fetch player's selected cards
    const p1UserCards = await prisma.userCard.findMany({
      where: { id: { in: input.selectedUserCardIds }, userId: player.id },
      include: { card: true },
    })

    if (p1UserCards.length === 0) {
      return NextResponse.json({ error: 'No valid cards selected' }, { status: 400 })
    }

    // Validate energy
    const exhausted = p1UserCards.filter((uc) => uc.energy <= 0)
    if (exhausted.length > 0) {
      return NextResponse.json({ error: 'Some selected cards have no energy' }, { status: 400 })
    }

    // Pick random opponent cards
    const opponentCards = await prisma.userCard.findMany({
      where: { userId: opponent.id, energy: { gt: 0 } },
      include: { card: true },
      take: input.format === 'ONE_V_ONE' ? 1 : 3,
    })

    if (opponentCards.length === 0) {
      // Give opponent fallback card from all cards
      const fallback = await prisma.card.findFirst()
      if (!fallback) return NextResponse.json({ error: 'No opponent cards available' }, { status: 400 })
      // Use a synthetic placeholder — won't deduct energy from real user
    }

    const mapCard = (uc: typeof p1UserCards[0]): { card: Card; userCard: UserCard } => ({
      card: {
        id: uc.card.id,
        playerName: uc.card.playerName,
        rarity: uc.card.rarity as Card['rarity'],
        club: uc.card.club,
        position: uc.card.position as Card['position'],
        imageUrl: uc.card.imageUrl,
        isCustom: uc.card.isCustom,
        stats: {
          speed: uc.card.speed,
          shot: uc.card.shot,
          dribbling: uc.card.dribbling,
          physical: uc.card.physical,
          defense: uc.card.defense,
        },
        createdAt: uc.card.createdAt.toISOString(),
      },
      userCard: {
        id: uc.id,
        cardId: uc.cardId,
        card: {} as Card,
        energy: uc.energy,
        maxEnergy: uc.maxEnergy,
        cooldownEndAt: uc.cooldownEndAt?.toISOString() ?? null,
        timesUsed: uc.timesUsed,
        acquiredAt: uc.acquiredAt.toISOString(),
        isExhausted: uc.energy <= 0,
        isOnCooldown: false,
      },
    })

    const p1Mapped = p1UserCards.map(mapCard)
    const p2Mapped = opponentCards.length > 0 ? opponentCards.map(mapCard) : p1Mapped // fallback mirror

    const result = input.format === 'ONE_V_ONE'
      ? resolveSingleBattle(p1Mapped[0], p2Mapped[0], player.id, opponent.id)
      : resolveTeamBattle(p1Mapped, p2Mapped, player.id, opponent.id)

    // Create battle record
    const battle = await prisma.battle.create({
      data: {
        player1Id: player.id,
        player2Id: opponent.id,
        format: input.format,
        status: 'COMPLETED',
        winnerId: result.winnerId,
        player1Power: result.player1Power,
        player2Power: result.player2Power,
        xpGained: result.xpGained,
        coinsGained: result.coinsGained,
        resultSummary: result.resultSummary,
        resolvedAt: new Date(),
      },
    })

    result.battleId = battle.id

    // Deduct energy from player cards
    const newCooldown = new Date(Date.now() + CARD_ENERGY.RESTORE_COOLDOWN_HOURS * 3600000)
    for (const uc of p1UserCards) {
      const newEnergy = Math.max(0, uc.energy - CARD_ENERGY.ENERGY_PER_BATTLE)
      await prisma.userCard.update({
        where: { id: uc.id },
        data: {
          energy: newEnergy,
          timesUsed: { increment: 1 },
          cooldownEndAt: newEnergy === 0 ? newCooldown : null,
        },
      })
    }

    // Update player profile
    const currentProfile = player.profile
    if (currentProfile) {
      const newXp = currentProfile.xp + result.xpGained
      const newLevel = xpToLevel(newXp)
      await prisma.playerProfile.update({
        where: { userId: player.id },
        data: {
          xp: { increment: result.xpGained },
          coins: { increment: result.coinsGained },
          battlesPlayed: { increment: 1 },
          battlesWon: result.winnerId === player.id ? { increment: 1 } : undefined,
          level: newLevel,
        },
      })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[battle POST]', err)
    return NextResponse.json({ error: 'Battle failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const telegramId = searchParams.get('telegramId')
  if (!telegramId) return NextResponse.json({ error: 'telegramId required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const battles = await prisma.battle.findMany({
    where: { OR: [{ player1Id: user.id }, { player2Id: user.id }] },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      player1: { include: { profile: true } },
      player2: { include: { profile: true } },
    },
  })

  return NextResponse.json({ data: battles })
}
