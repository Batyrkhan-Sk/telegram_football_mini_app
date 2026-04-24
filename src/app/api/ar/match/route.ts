import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ArMatchStatus, ArShotOutcome } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AR_MODE } from '@/config/game'

const CreateSchema = z.object({
  telegramId: z.string(),
})

const JoinSchema = z.object({
  action: z.literal('join'),
  telegramId: z.string(),
})

const ShotSchema = z.object({
  action: z.literal('shot'),
  telegramId: z.string(),
  outcome: z.enum(['goal', 'save', 'wide', 'soft']),
  power: z.number().min(0).max(1),
  angle: z.number(),
})

function toApiMatch(match: Awaited<ReturnType<typeof getMatch>>, viewerId?: string) {
  if (!match) return null
  const p1Shots = match.shots.filter((shot) => shot.userId === match.player1Id)
  const p2Shots = match.player2Id ? match.shots.filter((shot) => shot.userId === match.player2Id) : []
  const player1Goals = p1Shots.filter((shot) => shot.outcome === 'GOAL').length
  const player2Goals = p2Shots.filter((shot) => shot.outcome === 'GOAL').length

  return {
    id: match.id,
    status: match.status,
    maxRounds: match.maxRounds,
    currentTurnUserId: match.currentTurnUserId,
    winnerId: match.winnerId,
    player1Goals,
    player2Goals,
    player1Shots: p1Shots.length,
    player2Shots: p2Shots.length,
    isYourTurn: !!viewerId && match.currentTurnUserId === viewerId && match.status !== 'COMPLETED',
    canJoin: !!viewerId && !match.player2Id && match.player1Id !== viewerId && match.status !== 'COMPLETED',
    isParticipant: !!viewerId && (match.player1Id === viewerId || match.player2Id === viewerId),
    player1: match.player1,
    player2: match.player2,
    shots: match.shots.map((shot) => ({
      id: shot.id,
      userId: shot.userId,
      round: shot.round,
      outcome: shot.outcome,
      power: shot.power,
      angle: shot.angle,
      createdAt: shot.createdAt.toISOString(),
    })),
    createdAt: match.createdAt.toISOString(),
    completedAt: match.completedAt?.toISOString() ?? null,
  }
}

async function getMatch(id: string) {
  return prisma.arPenaltyMatch.findUnique({
    where: { id },
    include: {
      player1: { include: { profile: true } },
      player2: { include: { profile: true } },
      shots: { orderBy: [{ round: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

async function getUser(telegramId: string) {
  return prisma.user.findUnique({ where: { telegramId } })
}

function nextState(input: {
  match: NonNullable<Awaited<ReturnType<typeof getMatch>>>
  player1Goals: number
  player2Goals: number
  player1Shots: number
  player2Shots: number
}) {
  const { match, player1Goals, player2Goals, player1Shots, player2Shots } = input
  const maxRounds = match.maxRounds

  if (player1Shots >= maxRounds && player2Shots >= maxRounds) {
    return {
      status: ArMatchStatus.COMPLETED,
      currentTurnUserId: null,
      winnerId: player1Goals > player2Goals ? match.player1Id : player2Goals > player1Goals ? match.player2Id : null,
      completedAt: new Date(),
    }
  }

  if (!match.player2Id) {
    return {
      status: ArMatchStatus.WAITING,
      currentTurnUserId: null,
      winnerId: null,
      completedAt: null,
    }
  }

  if (player1Shots > player2Shots) {
    return {
      status: ArMatchStatus.ACTIVE,
      currentTurnUserId: match.player2Id,
      winnerId: null,
      completedAt: null,
    }
  }

  return {
    status: ArMatchStatus.ACTIVE,
    currentTurnUserId: match.player1Id,
    winnerId: null,
    completedAt: null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = CreateSchema.parse(await req.json())
    const user = await getUser(input.telegramId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const match = await prisma.arPenaltyMatch.create({
      data: {
        player1Id: user.id,
        currentTurnUserId: user.id,
        status: 'PENDING',
        maxRounds: AR_MODE.SHOTS_PER_SESSION,
      },
    })

    const fullMatch = await getMatch(match.id)
    return NextResponse.json({ data: toApiMatch(fullMatch, user.id) })
  } catch (error) {
    console.error('[ar/match POST]', error)
    return NextResponse.json({ error: 'Failed to create AR match' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const telegramId = searchParams.get('telegramId')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const viewer = telegramId ? await getUser(telegramId) : null
    const match = await getMatch(id)
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    return NextResponse.json({ data: toApiMatch(match, viewer?.id) })
  } catch (error) {
    console.error('[ar/match GET]', error)
    return NextResponse.json({ error: 'Failed to load AR match' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const action = z.discriminatedUnion('action', [JoinSchema, ShotSchema]).parse(body)
    const user = await getUser(action.telegramId)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const match = await getMatch(id)
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status === 'COMPLETED' || match.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Match is already finished' }, { status: 400 })
    }

    if (action.action === 'join') {
      if (match.player1Id === user.id) return NextResponse.json({ error: 'You cannot join your own match' }, { status: 400 })
      if (match.player2Id && match.player2Id !== user.id) return NextResponse.json({ error: 'Match already has an opponent' }, { status: 400 })

      const player1Shots = match.shots.filter((shot) => shot.userId === match.player1Id).length
      const update = await prisma.arPenaltyMatch.update({
        where: { id },
        data: {
          player2Id: user.id,
          status: 'ACTIVE',
          currentTurnUserId: player1Shots > 0 ? user.id : match.player1Id,
        },
      })

      const fullMatch = await getMatch(update.id)
      return NextResponse.json({ data: toApiMatch(fullMatch, user.id) })
    }

    const isParticipant = match.player1Id === user.id || match.player2Id === user.id
    if (!isParticipant) return NextResponse.json({ error: 'Join this match before shooting' }, { status: 403 })
    if (match.currentTurnUserId !== user.id) return NextResponse.json({ error: 'Not your turn' }, { status: 400 })

    const round = match.shots.filter((shot) => shot.userId === user.id).length + 1
    if (round > match.maxRounds) return NextResponse.json({ error: 'No shots remaining' }, { status: 400 })

    const outcomeMap: Record<string, ArShotOutcome> = {
      goal: 'GOAL',
      save: 'SAVE',
      wide: 'WIDE',
      soft: 'SOFT',
    }

    await prisma.arPenaltyShot.create({
      data: {
        matchId: match.id,
        userId: user.id,
        round,
        outcome: outcomeMap[action.outcome],
        power: action.power,
        angle: action.angle,
      },
    })

    const updated = await getMatch(id)
    if (!updated) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

    const p1Shots = updated.shots.filter((shot) => shot.userId === updated.player1Id)
    const p2Shots = updated.player2Id ? updated.shots.filter((shot) => shot.userId === updated.player2Id) : []
    const state = nextState({
      match: updated,
      player1Goals: p1Shots.filter((shot) => shot.outcome === 'GOAL').length,
      player2Goals: p2Shots.filter((shot) => shot.outcome === 'GOAL').length,
      player1Shots: p1Shots.length,
      player2Shots: p2Shots.length,
    })

    await prisma.arPenaltyMatch.update({
      where: { id },
      data: state,
    })

    const fullMatch = await getMatch(id)
    return NextResponse.json({ data: toApiMatch(fullMatch, user.id) })
  } catch (error) {
    console.error('[ar/match PATCH]', error)
    return NextResponse.json({ error: 'Failed to update AR match' }, { status: 500 })
  }
}
