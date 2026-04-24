import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { xpToLevel } from '@/lib/battle/engine'
import { ensureStarterCards } from '@/lib/starter-card'

const InitSchema = z.object({
  telegramId: z.string(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatarUrl: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const input = InitSchema.parse(body)

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { telegramId: input.telegramId },
      include: { profile: true },
    })

    if (!user) {
      // New user — give starter card
      user = await prisma.user.create({
        data: {
          telegramId: input.telegramId,
          username: input.username,
          firstName: input.firstName,
          lastName: input.lastName,
          avatarUrl: input.avatarUrl,
          profile: {
            create: { xp: 0, level: 1, coins: 50 },
          },
        },
        include: { profile: true },
      })

    } else {
      // Update Telegram info if changed
      await prisma.user.update({
        where: { id: user.id },
        data: {
          username: input.username ?? user.username,
          firstName: input.firstName ?? user.firstName,
          lastName: input.lastName ?? user.lastName,
        },
      })
    }

    await ensureStarterCards(user.id)

    // Recalculate level from XP
    if (user.profile) {
      const correctLevel = xpToLevel(user.profile.xp)
      if (correctLevel !== user.profile.level) {
        await prisma.playerProfile.update({
          where: { userId: user.id },
          data: { level: correctLevel },
        })
        user.profile.level = correctLevel
      }
    }

    const profile = await prisma.playerProfile.findUnique({ where: { userId: user.id } })

    return NextResponse.json({
      data: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        profile,
      },
    })
  } catch (error) {
    console.error('[user/init]', error)
    return NextResponse.json({ error: 'Failed to init user' }, { status: 500 })
  }
}
