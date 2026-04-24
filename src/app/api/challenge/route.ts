import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const CreateChallengeSchema = z.object({
  telegramId: z.string(),
  format: z.enum(['ONE_V_ONE', 'THREE_V_THREE']),
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
