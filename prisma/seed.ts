import { PrismaClient, CardRarity, Position, RewardType, BattleFormat, BattleStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // --- Cards: FC Kairat roster + placeholders ---
  const cards = await Promise.all([
    prisma.card.upsert({
      where: { id: 'card-satpayev' },
      update: {},
      create: {
        id: 'card-satpayev',
        playerName: 'Dastan Satpayev',
        rarity: CardRarity.LEGENDARY,
        club: 'FC Kairat',
        position: Position.MID,
        imageUrl: '/cards/satpayev.png',
        speed: 85, shot: 82, dribbling: 88, physical: 75, defense: 70,
      },
    }),
    prisma.card.upsert({
      where: { id: 'card-anarbekov' },
      update: {},
      create: {
        id: 'card-anarbekov',
        playerName: 'Temirlan Anarbekov',
        rarity: CardRarity.EPIC,
        club: 'FC Kairat',
        position: Position.FWD,
        imageUrl: '/cards/anarbekov.png',
        speed: 90, shot: 86, dribbling: 83, physical: 72, defense: 48,
      },
    }),
    prisma.card.upsert({
      where: { id: 'card-kalmurza' },
      update: {},
      create: {
        id: 'card-kalmurza',
        playerName: 'Sherkhan Kalmurza',
        rarity: CardRarity.EPIC,
        club: 'FC Kairat',
        position: Position.DEF,
        imageUrl: '/cards/kalmurza.png',
        speed: 74, shot: 55, dribbling: 71, physical: 86, defense: 88,
      },
    }),
    prisma.card.upsert({
      where: { id: 'card-gk-demo' },
      update: {},
      create: {
        id: 'card-gk-demo',
        playerName: 'Stas Pokatilov',
        rarity: CardRarity.RARE,
        club: 'FC Kairat',
        position: Position.GK,
        imageUrl: '/cards/gk-demo.png',
        speed: 60, shot: 40, dribbling: 55, physical: 80, defense: 90,
      },
    }),
    prisma.card.upsert({
      where: { id: 'card-mid-rare' },
      update: {},
      create: {
        id: 'card-mid-rare',
        playerName: 'Amir Zeinolla',
        rarity: CardRarity.RARE,
        club: 'FC Kairat',
        position: Position.MID,
        imageUrl: '/cards/mid-rare.png',
        speed: 78, shot: 72, dribbling: 76, physical: 68, defense: 65,
      },
    }),
    prisma.card.upsert({
      where: { id: 'card-fwd-common' },
      update: {},
      create: {
        id: 'card-fwd-common',
        playerName: 'Nurlan Bekzat',
        rarity: CardRarity.COMMON,
        club: 'FC Kairat',
        position: Position.FWD,
        imageUrl: '/cards/fwd-common.png',
        speed: 72, shot: 68, dribbling: 65, physical: 65, defense: 42,
      },
    }),
  ])

  console.log(`✅ Seeded ${cards.length} cards`)

  // --- Demo user ---
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

  // Give demo user cards
  for (const card of cards.slice(0, 4)) {
    await prisma.userCard.upsert({
      where: { userId_cardId: { userId: demoUser.id, cardId: card.id } },
      update: {},
      create: {
        userId: demoUser.id,
        cardId: card.id,
        energy: card.id === 'card-gk-demo' ? 0 : 100,
        cooldownEndAt: card.id === 'card-gk-demo' ? new Date(Date.now() + 72 * 60 * 60 * 1000) : null,
      },
    })
  }

  // --- Opponent profiles (mock AI players) ---
  const opponents = [
    { telegramId: '200000001', username: 'sultan_kz', firstName: 'Sultan', xp: 2100, level: 8, battlesWon: 22 },
    { telegramId: '200000002', username: 'kz_striker9', firstName: 'Dias', xp: 1800, level: 7, battlesWon: 18 },
    { telegramId: '200000003', username: 'almaty_united', firstName: 'Berik', xp: 980, level: 4, battlesWon: 7 },
    { telegramId: '200000004', username: 'nomad_fc', firstName: 'Timur', xp: 540, level: 2, battlesWon: 3 },
    { telegramId: '200000005', username: 'steppe_eagle', firstName: 'Aizat', xp: 3200, level: 12, battlesWon: 35 },
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

    // Give opponents random cards
    const randCards = cards.sort(() => 0.5 - Math.random()).slice(0, 3)
    for (const card of randCards) {
      await prisma.userCard.upsert({
        where: { userId_cardId: { userId: u.id, cardId: card.id } },
        update: {},
        create: { userId: u.id, cardId: card.id, energy: 100 },
      })
    }
  }

  console.log('✅ Seeded demo users and opponents')

  // --- Promo codes ---
  const promoCodes: Array<{
    code: string
    rewardType: RewardType
    rewardValue?: number
    campaign: string
  }> = [
    { code: 'SNICKERS-KAIRAT-2024', rewardType: RewardType.CARD_RESTORE, campaign: 'launch' },
    { code: 'SNICKERS-DEMO-01', rewardType: RewardType.CARD_RESTORE, campaign: 'demo' },
    { code: 'SNICKERS-DEMO-02', rewardType: RewardType.CARD_RESTORE, campaign: 'demo' },
    { code: 'SNICKERS-DEMO-03', rewardType: RewardType.AR_COOLDOWN_BYPASS, campaign: 'demo' },
  ]

  for (const pc of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: pc.code },
      update: {},
      create: {
        code: pc.code,
        rewardType: pc.rewardType as RewardType,
        rewardValue: pc.rewardValue ?? 0,
        campaign: pc.campaign,
        maxUses: 1,
        expiresAt: new Date('2027-12-31'),
      },
    })
  }

  console.log('✅ Seeded promo codes')

  // --- Mock battles for demo history ---
  const [opp1] = await Promise.all([
    prisma.user.findUnique({ where: { telegramId: '200000001' } }),
  ])

  if (opp1) {
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

  console.log('✅ Seeded battle history')
  console.log('🎉 Seed complete!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
