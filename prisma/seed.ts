import { PrismaClient, CardRarity, Position, RewardType, BattleFormat, BattleStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Delete stale card that is no longer needed ───────────────────────────────
  await prisma.userCard.deleteMany({ where: { cardId: 'card-mid-rare' } })
  await prisma.card.deleteMany({ where: { id: 'card-mid-rare' } })
  console.log('🗑️  Removed stale card-mid-rare')

  // ─── Card roster ──────────────────────────────────────────────────────────────
  const cardData = [
    {
      id: 'card-satpayev',
      playerName: 'Dastan Satpayev',
      rarity: CardRarity.LEGENDARY,
      club: 'FC Kairat',
      position: Position.MID,
      imageUrl: '/cards/satpayev.png',
      speed: 85, shot: 82, dribbling: 88, physical: 75, defense: 70,
    },
    {
      id: 'card-anarbekov',
      playerName: 'Temirlan Anarbekov',
      rarity: CardRarity.EPIC,
      club: 'FC Kairat',
      position: Position.FWD,
      imageUrl: '/cards/anarbekov.png',
      speed: 90, shot: 86, dribbling: 83, physical: 72, defense: 48,
    },
    {
      id: 'card-kalmurza',
      playerName: 'Sherkhan Kalmurza',
      rarity: CardRarity.EPIC,
      club: 'FC Kairat',
      position: Position.DEF,
      imageUrl: '/cards/kalmurza.png',
      speed: 74, shot: 55, dribbling: 71, physical: 86, defense: 88,
    },
    {
      // GK → Sherkhan Kalmurza (as requested)
      id: 'card-gk-demo',
      playerName: 'Sherkhan Kalmurza',
      rarity: CardRarity.RARE,
      club: 'FC Kairat',
      position: Position.GK,
      imageUrl: '/cards/kalmurza.png',
      speed: 60, shot: 40, dribbling: 55, physical: 80, defense: 90,
    },
    {
      // DEF → Aleksandr Martynovich (as requested)
      id: 'card-def-rare',
      playerName: 'Aleksandr Martynovich',
      rarity: CardRarity.RARE,
      club: 'FC Kairat',
      position: Position.DEF,
      imageUrl: '/cards/martynovich.png',
      speed: 78, shot: 72, dribbling: 76, physical: 68, defense: 65,
    },
    {
      // FWD → Dastan Satpayev (as requested)
      id: 'card-fwd-common',
      playerName: 'Dastan Satpayev',
      rarity: CardRarity.COMMON,
      club: 'FC Kairat',
      position: Position.FWD,
      imageUrl: '/cards/satpayev.png',
      speed: 72, shot: 68, dribbling: 65, physical: 65, defense: 42,
    },
  ] as const

  // update block mirrors create — stale names always overwritten
  const cards = await Promise.all(
    cardData.map(({ id, ...fields }) =>
      prisma.card.upsert({
        where: { id },
        update: { ...fields },
        create: { id, ...fields },
      })
    )
  )

  console.log(`✅ Seeded ${cards.length} cards`)

  // ─── Demo user ────────────────────────────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { telegramId: '100000001' },
    update: {},
    create: {
      telegramId: '100000001',
      username: 'kairat_fan',
      firstName: 'Arman',
      lastName: 'Demo',
      profile: {
        create: {
          xp: 1240,
          level: 5,
          coins: 320,
          battlesPlayed: 14,
          battlesWon: 9,
          qrScansUsed: 3,
        },
      },
    },
  })

  // Give demo user first 4 cards
  const demoCardIds = ['card-satpayev', 'card-anarbekov', 'card-kalmurza', 'card-gk-demo']
  for (const cardId of demoCardIds) {
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId: demoUser.id, cardId } },
      update: {},
      create: {
        userId: demoUser.id,
        cardId,
        energy: cardId === 'card-gk-demo' ? 0 : 100,
        cooldownEndAt: cardId === 'card-gk-demo'
          ? new Date(Date.now() + 72 * 60 * 60 * 1000)
          : null,
      },
    })
  }

  // ─── Opponent profiles ────────────────────────────────────────────────────────
  const opponents = [
    { telegramId: '200000001', username: 'sultan_kz',     firstName: 'Sultan', xp: 2100, level: 8,  battlesWon: 22 },
    { telegramId: '200000002', username: 'kz_striker9',   firstName: 'Dias',   xp: 1800, level: 7,  battlesWon: 18 },
    { telegramId: '200000003', username: 'almaty_united', firstName: 'Berik',  xp: 980,  level: 4,  battlesWon: 7  },
    { telegramId: '200000004', username: 'nomad_fc',      firstName: 'Timur',  xp: 540,  level: 2,  battlesWon: 3  },
    { telegramId: '200000005', username: 'steppe_eagle',  firstName: 'Aizat',  xp: 3200, level: 12, battlesWon: 35 },
  ]

  for (const opp of opponents) {
    const u = await prisma.user.upsert({
      where: { telegramId: opp.telegramId },
      update: {},
      create: {
        telegramId: opp.telegramId,
        username: opp.username,
        firstName: opp.firstName,
        profile: {
          create: {
            xp: opp.xp,
            level: opp.level,
            battlesWon: opp.battlesWon,
            battlesPlayed: opp.battlesWon + Math.floor(opp.battlesWon * 0.4),
            coins: Math.floor(opp.xp * 0.3),
          },
        },
      },
    })

    const randCards = [...cards].sort(() => 0.5 - Math.random()).slice(0, 3)
    for (const card of randCards) {
      await prisma.userCard.upsert({
        where: { userId_cardId: { userId: u.id, cardId: card.id } },
        update: {},
        create: { userId: u.id, cardId: card.id, energy: 100 },
      })
    }
  }

  console.log('✅ Seeded demo users and opponents')

  // ─── Promo codes ──────────────────────────────────────────────────────────────
  const promoCodes = [
    { code: 'SNICKERS-KAIRAT-2026',   rewardType: RewardType.CARD_RESTORE,       campaign: 'launch' },
    { code: 'SNICKERS-ДУШНИЛА-01',    rewardType: RewardType.CARD_RESTORE,       campaign: 'demo'   },
    { code: 'SNICKERS-МАЗАСЫЗ-02',    rewardType: RewardType.CARD_RESTORE,       campaign: 'demo'   },
    { code: 'SNICKERS-ВТИЛЬТЕ-03',    rewardType: RewardType.AR_COOLDOWN_BYPASS, campaign: 'demo'   },
  ]

  for (const pc of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: pc.code },
      update: {},
      create: {
        code: pc.code,
        rewardType: pc.rewardType,
        rewardValue: 0,
        campaign: pc.campaign,
        maxUses: 1,
        expiresAt: pc.campaign === 'demo' ? null : new Date('2027-12-31'),
      },
    })
  }

  console.log('✅ Seeded promo codes')

  // ─── Mock battle history (idempotent) ─────────────────────────────────────────
  const opp1 = await prisma.user.findUnique({ where: { telegramId: '200000001' } })

  if (opp1) {
    const existingBattle = await prisma.battle.findFirst({
      where: { player1Id: demoUser.id, player2Id: opp1.id },
    })

    if (!existingBattle) {
      await prisma.battle.create({
        data: {
          player1Id: demoUser.id,
          player2Id: opp1.id,
          format: BattleFormat.ONE_V_ONE,
          status: BattleStatus.COMPLETED,
          winnerId: demoUser.id,
          player1Power: 84.5,
          player2Power: 71.2,
          xpGained: 80,
          coinsGained: 25,
          resultSummary: 'GOAL_SCORED',
          resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        },
      })
    }
  }

  console.log('✅ Seeded battle history')
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())