import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resolveSingleBattle, resolveTeamBattle, xpToLevel } from '@/lib/battle/engine'
import { CARD_ENERGY } from '@/config/game'
import type { Card, UserCard } from '@/types'

const CreateChallengeSchema = z.object({
  telegramId: z.string(),
  format: z.enum(['ONE_V_ONE', 'THREE_V_THREE']),
})

const AcceptChallengeSchema = z.object({
  telegramId: z.string(),
  selectedUserCardIds: z.array(z.string()),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = CreateChallengeSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { telegramId: input.telegramId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const challenge = await prisma.challenge.create({
      data: {
        senderId: user.id,
        format: input.format,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000), // 24h
      },
    })

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/battle/${challenge.id}?token=${challenge.deepLinkToken}`

    return NextResponse.json({
      data: {
        challengeId: challenge.id,
        token: challenge.deepLinkToken,
        shareUrl,
        format: challenge.format,
        expiresAt: challenge.expiresAt.toISOString(),
      },
    })
  } catch (err) {
    console.error('[challenge POST]', err)
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const id = searchParams.get('id')

  if (!token && !id) return NextResponse.json({ error: 'token or id required' }, { status: 400 })

  const challenge = await prisma.challenge.findFirst({
    where: token ? { deepLinkToken: token } : { id: id! },
    include: {
      sender: { include: { profile: true } },
      receiver: { include: { profile: true } },
    },
  })

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  if (challenge.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 400 })
  }

  return NextResponse.json({ data: challenge })
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const token = searchParams.get('token')
    const input = AcceptChallengeSchema.parse(await req.json())

    if (!id && !token) {
      return NextResponse.json({ error: 'id or token required' }, { status: 400 })
    }

    const challenge = await prisma.challenge.findFirst({
      where: id ? { id } : { deepLinkToken: token! },
      include: { sender: { include: { profile: true } } },
    })

    if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    if (challenge.status !== 'PENDING') {
      return NextResponse.json({ error: 'Challenge is no longer pending' }, { status: 400 })
    }
    if (challenge.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Challenge has expired' }, { status: 400 })
    }

    const receiver = await prisma.user.findUnique({
      where: { telegramId: input.telegramId },
      include: { profile: true },
    })

    if (!receiver) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (receiver.id === challenge.senderId) {
      return NextResponse.json({ error: 'You cannot accept your own challenge' }, { status: 400 })
    }

    const maxCards = challenge.format === 'ONE_V_ONE' ? 1 : 3
    if (input.selectedUserCardIds.length !== maxCards) {
      return NextResponse.json({ error: `Select ${maxCards} card${maxCards > 1 ? 's' : ''}` }, { status: 400 })
    }

    const receiverCards = await prisma.userCard.findMany({
      where: { id: { in: input.selectedUserCardIds }, userId: receiver.id },
      include: { card: true },
    })

    if (receiverCards.length !== maxCards) {
      return NextResponse.json({ error: 'No valid cards selected' }, { status: 400 })
    }

    if (receiverCards.some((uc) => uc.energy <= 0)) {
      return NextResponse.json({ error: 'Some selected cards have no energy' }, { status: 400 })
    }

    const senderCards = await prisma.userCard.findMany({
      where: { userId: challenge.senderId, energy: { gt: 0 } },
      include: { card: true },
      take: maxCards,
    })

    if (senderCards.length === 0) {
      return NextResponse.json({ error: 'Challenger has no available cards' }, { status: 400 })
    }

    const mapCard = (uc: typeof receiverCards[0]): { card: Card; userCard: UserCard } => ({
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

    const senderMapped = senderCards.map(mapCard)
    const receiverMapped = receiverCards.map(mapCard)
    const result = challenge.format === 'ONE_V_ONE'
      ? resolveSingleBattle(senderMapped[0], receiverMapped[0], challenge.senderId, receiver.id)
      : resolveTeamBattle(senderMapped, receiverMapped, challenge.senderId, receiver.id)

    const battle = await prisma.battle.create({
      data: {
        player1Id: challenge.senderId,
        player2Id: receiver.id,
        format: challenge.format,
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

    await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        receiverId: receiver.id,
        battleId: battle.id,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    })

    const newCooldown = new Date(Date.now() + CARD_ENERGY.RESTORE_COOLDOWN_HOURS * 3600000)
    for (const uc of receiverCards) {
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

    for (const user of [challenge.sender, receiver]) {
      if (!user.profile) continue
      const won = result.winnerId === user.id
      const xpGained = won || result.isDraw ? result.xpGained : Math.floor(result.xpGained / 2)
      const coinsGained = won ? result.coinsGained : 0

      await prisma.playerProfile.update({
        where: { userId: user.id },
        data: {
          xp: { increment: xpGained },
          coins: { increment: coinsGained },
          battlesPlayed: { increment: 1 },
          battlesWon: won ? { increment: 1 } : undefined,
          level: xpToLevel(user.profile.xp + xpGained),
        },
      })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[challenge PATCH]', err)
    return NextResponse.json({ error: 'Failed to accept challenge' }, { status: 500 })
  }
}
