import { prisma } from '@/lib/db'

export async function ensureStarterCard(userId: string) {
  const existingCards = await prisma.userCard.count({ where: { userId } })
  if (existingCards > 0) return

  const starterCard =
    await prisma.card.findUnique({ where: { id: 'card-fwd-common' } }) ??
    await prisma.card.findFirst({ where: { rarity: 'COMMON' } }) ??
    await prisma.card.findFirst()

  if (!starterCard) return

  await prisma.userCard.upsert({
    where: { userId_cardId: { userId, cardId: starterCard.id } },
    update: { energy: 100, cooldownEndAt: null },
    create: {
      userId,
      cardId: starterCard.id,
      energy: 100,
      maxEnergy: 100,
    },
  })
}
