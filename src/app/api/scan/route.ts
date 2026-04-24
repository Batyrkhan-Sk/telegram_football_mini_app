import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { xpToLevel } from '@/lib/battle/engine'
import { ECONOMY, AR_MODE } from '@/config/game'

const RedeemSchema = z.object({
  telegramId: z.string(),
  code: z.string().min(3).max(64),
  context: z.enum(['card_restore', 'ar_bypass', 'general']).optional(),
  targetUserCardId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = RedeemSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { telegramId: input.telegramId },
      include: { profile: true },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: input.code.toUpperCase().trim() },
      include: { redemptions: { where: { userId: user.id } } },
    })

    if (!promoCode) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 400 })
    }

    if (!promoCode.isActive) {
      return NextResponse.json({ error: 'This code is no longer active' }, { status: 400 })
    }

    if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This code has expired' }, { status: 400 })
    }

    if (promoCode.usedCount >= promoCode.maxUses) {
      return NextResponse.json({ error: 'This code has already been used' }, { status: 400 })
    }

    if (promoCode.redemptions.length > 0) {
      return NextResponse.json({ error: 'You have already used this code' }, { status: 400 })
    }

    // Apply reward
    let message = ''
    let rewardValue = promoCode.rewardValue

    switch (promoCode.rewardType) {
      case 'CARD_RESTORE': {
        // Restore exhausted cards
        const exhaustedCards = await prisma.userCard.findMany({
          where: { userId: user.id, energy: 0 },
          take: 1,
        })

        if (exhaustedCards.length > 0) {
          const target = input.targetUserCardId
            ? exhaustedCards.find((c) => c.id === input.targetUserCardId) ?? exhaustedCards[0]
            : exhaustedCards[0]

          await prisma.userCard.update({
            where: { id: target.id },
            data: { energy: target.maxEnergy, cooldownEndAt: null },
          })
          message = 'Card energy fully restored! ⚡'
        } else {
          // No exhausted cards — give bonus coins instead
          await prisma.playerProfile.update({
            where: { userId: user.id },
            data: { coins: { increment: 50 } },
          })
          message = 'No exhausted cards — you received 50 bonus coins instead!'
          rewardValue = 50
        }
        break
      }

      case 'AR_COOLDOWN_BYPASS': {
        await prisma.playerProfile.update({
          where: { userId: user.id },
          data: { arCooldownEnd: null },
        })
        message = 'AR Penalty mode cooldown removed! 🎯'
        break
      }

      case 'BONUS_COINS': {
        const amount = promoCode.rewardValue || ECONOMY.COINS_QR_BONUS_DEFAULT
        await prisma.playerProfile.update({
          where: { userId: user.id },
          data: { coins: { increment: amount } },
        })
        message = `+${amount} coins added to your wallet! 💰`
        rewardValue = amount
        break
      }

      case 'BONUS_XP': {
        const amount = promoCode.rewardValue || 100
        const newXp = (user.profile?.xp ?? 0) + amount
        const newLevel = xpToLevel(newXp)
        await prisma.playerProfile.update({
          where: { userId: user.id },
          data: { xp: { increment: amount }, level: newLevel },
        })
        message = `+${amount} XP earned! Keep going! ⭐`
        rewardValue = amount
        break
      }
    }

    // Record redemption + increment code usage
    await prisma.$transaction([
      prisma.promoRedemption.create({
        data: {
          userId: user.id,
          codeId: promoCode.id,
          rewardType: promoCode.rewardType,
          rewardValue,
          appliedTo: input.targetUserCardId,
        },
      }),
      prisma.promoCode.update({
        where: { id: promoCode.id },
        data: { usedCount: { increment: 1 } },
      }),
      prisma.playerProfile.update({
        where: { userId: user.id },
        data: { qrScansUsed: { increment: 1 } },
      }),
    ])

    return NextResponse.json({
      data: {
        success: true,
        rewardType: promoCode.rewardType,
        rewardValue,
        message,
      },
    })
  } catch (err) {
    console.error('[scan POST]', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Redemption failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const telegramId = searchParams.get('telegramId')
  if (!telegramId) return NextResponse.json({ error: 'required' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { telegramId } })
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const history = await prisma.promoRedemption.findMany({
    where: { userId: user.id },
    include: { code: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({ data: history })
}
