import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const profiles = await prisma.playerProfile.findMany({
      orderBy: { xp: 'desc' },
      take: 50,
      include: {
        user: true,
      },
    })

    const leaderboard = profiles.map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      username: p.user.username,
      firstName: p.user.firstName,
      avatarUrl: p.user.avatarUrl,
      xp: p.xp,
      level: p.level,
      battlesWon: p.battlesWon,
    }))

    return NextResponse.json({ data: leaderboard })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
