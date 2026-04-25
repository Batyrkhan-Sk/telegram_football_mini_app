import { prisma } from '@/lib/db'
import { CardRarity, Position } from '@prisma/client'

const STARTER_CARDS = [
  {
    id: 'card-fwd-common',
    playerName: 'Aleksandr Martynovich',
    rarity: CardRarity.COMMON,
    club: 'FC Kairat',
    position: Position.FWD,
    imageUrl: '/cards/fwd-common.png',
    speed: 72,
    shot: 68,
    dribbling: 65,
    physical: 65,
    defense: 42,
  },
  {
    id: 'card-mid-rare',
    playerName: 'Adilet Sadybekov',
    rarity: CardRarity.RARE,
    club: 'FC Kairat',
    position: Position.MID,
    imageUrl: '/cards/mid-rare.png',
    speed: 78,
    shot: 72,
    dribbling: 76,
    physical: 68,
    defense: 65,
  },
  {
    id: 'card-gk-demo',
    playerName: 'Temirlan Anarbekov',
    rarity: CardRarity.RARE,
    club: 'FC Kairat',
    position: Position.GK,
    imageUrl: '/cards/anarbekov.png',
    speed: 60,
    shot: 40,
    dribbling: 55,
    physical: 80,
    defense: 90,
  },
]

const STARTER_CARD_IDS = STARTER_CARDS.map((card) => card.id)

async function ensureStarterCardCatalog() {
  await Promise.all(
    STARTER_CARDS.map((card) =>
      prisma.card.upsert({
        where: { id: card.id },
        update: { imageUrl: card.imageUrl },
        create: card,
      })
    )
  )
}

export async function ensureStarterCards(userId: string, minCards = 3) {
  await ensureStarterCardCatalog()

  const existingCards = await prisma.userCard.findMany({
    where: { userId },
    select: { cardId: true },
  })
  if (existingCards.length >= minCards) return

  const existingCardIds = new Set(existingCards.map((card) => card.cardId))
  const starterCards = await prisma.card.findMany({
    where: { id: { in: STARTER_CARD_IDS } },
    orderBy: { rarity: 'asc' },
  })

  const fallbackCards = await prisma.card.findMany({
    where: { id: { notIn: [...existingCardIds, ...starterCards.map((card) => card.id)] } },
    orderBy: [{ rarity: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(0, minCards - existingCards.length - starterCards.length),
  })

  const cardsToGrant = [...starterCards, ...fallbackCards]
    .filter((card) => !existingCardIds.has(card.id))
    .slice(0, minCards - existingCards.length)

  for (const card of cardsToGrant) {
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId, cardId: card.id } },
      update: {},
      create: {
        userId,
        cardId: card.id,
        energy: 100,
        maxEnergy: 100,
      },
    })
  }
}

export async function ensureStarterCard(userId: string) {
  await ensureStarterCards(userId, 1)
}
