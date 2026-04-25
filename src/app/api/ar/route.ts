import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { xpToLevel } from '@/lib/battle/engine'
import { ECONOMY, AR_MODE } from '@/config/game'

const ArResultSchema = z.object({
  telegramId: z.string(),
  goalsScored: z.number().min(0).max(5),
  totalShots: z.number().min(1).max(5),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = ArResultSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { telegramId: input.telegramId },
      include: { profile: true },
    })
    if (!user?.profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check cooldown
    if (user.profile.arCooldownEnd && user.profile.arCooldownEnd > new Date()) {
      return NextResponse.json({ error: 'Penalty game is on cooldown' }, { status: 400 })
    }

    const success = input.goalsScored >= AR_MODE.GOALS_TO_WIN
    const xpGained = success ? ECONOMY.XP_AR_SUCCESS : ECONOMY.XP_AR_FAIL
    const coinsGained = success ? ECONOMY.COINS_AR_SUCCESS : ECONOMY.COINS_AR_FAIL

    const newXp = user.profile.xp + xpGained
    const newLevel = xpToLevel(newXp)

    await prisma.playerProfile.update({
      where: { userId: user.id },
      data: {
        xp: { increment: xpGained },
        coins: { increment: coinsGained },
        level: newLevel,
        arSessionsPlayed: { increment: 1 },
        // Set cooldown only on failure
        arCooldownEnd: !success
          ? new Date(Date.now() + AR_MODE.SESSION_COOLDOWN_HOURS * 3600000)
          : null,
      },
    })

    return NextResponse.json({
      data: {
        goalsScored: input.goalsScored,
        totalShots: input.totalShots,
        success,
        xpGained,
        coinsGained,
        cooldownSet: !success,
        cooldownHours: !success ? AR_MODE.SESSION_COOLDOWN_HOURS : 0,
      },
    })
  } catch (err) {
    console.error('[ar POST]', err)
    return NextResponse.json({ error: 'AR session save failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const telegramId = searchParams.get('telegramId')
  if (!telegramId) return NextResponse.json({ error: 'required' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { profile: true },
  })
  if (!user?.profile) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const onCooldown = !!(user.profile.arCooldownEnd && user.profile.arCooldownEnd > new Date())

  return NextResponse.json({
    data: {
      onCooldown,
      cooldownEnd: user.profile.arCooldownEnd?.toISOString() ?? null,
      sessionsPlayed: user.profile.arSessionsPlayed,
    },
  })
}
