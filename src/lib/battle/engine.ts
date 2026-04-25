import { BATTLE_CONFIG, BATTLE_WEIGHTS, CARD_ENERGY, ECONOMY } from '@/config/game'
import type { BattleFormat, BattleResult, BattleResultSummary, Card, CardStats, UserCard } from '@/types'

// ─── Stat Power Calculation ────────────────────────────────────────────────────

function computeCardPower(card: Card, userCard: UserCard, role: 'attacker' | 'defender' | 'gk' | 'generic'): number {
  const weights = role === 'attacker' ? BATTLE_WEIGHTS.ATTACKER
    : role === 'defender' ? BATTLE_WEIGHTS.DEFENDER
    : role === 'gk' ? BATTLE_WEIGHTS.GK
    : BATTLE_WEIGHTS.GENERIC

  const stats = card.stats
  const rawPower =
    stats.speed * weights.speed +
    stats.shot * weights.shot +
    stats.dribbling * weights.dribbling +
    stats.physical * weights.physical +
    stats.defense * weights.defense

  // Rarity multiplier
  const rarityMult = BATTLE_CONFIG.RARITY_MULTIPLIERS[card.rarity] ?? 1.0

  // Energy penalty: below 30% energy = reduced effectiveness
  const energyRatio = userCard.energy / userCard.maxEnergy
  const energyMult = energyRatio < 0.3 ? BATTLE_CONFIG.ENERGY_LOW_PENALTY : 1.0

  // Random variance ±RANDOM_VARIANCE
  const variance = 1 + (Math.random() * 2 - 1) * BATTLE_CONFIG.RANDOM_VARIANCE

  return rawPower * rarityMult * energyMult * variance
}

function computeTeamPower(cards: Array<{ card: Card; userCard: UserCard }>): number {
  if (cards.length === 0) return 0

  const powers = cards.map(({ card, userCard }) => {
    const role = card.position === 'GK' ? 'gk'
      : card.position === 'DEF' ? 'defender'
      : card.position === 'FWD' ? 'attacker'
      : 'generic'
    return computeCardPower(card, userCard, role)
  })

  const totalPower = powers.reduce((a, b) => a + b, 0) / powers.length

  // 3-card team synergy: if all same club +5%
  const allSameClub = cards.every(c => c.card.club === cards[0].card.club)
  const synergyBonus = allSameClub && cards.length === 3 ? BATTLE_CONFIG.TEAM_SYNERGY_BONUS : 0

  return totalPower * (1 + synergyBonus)
}

// ─── Result Narrative ──────────────────────────────────────────────────────────

function selectResultSummary(winner: 1 | 2 | 'draw', powerDiff: number): BattleResultSummary {
  if (winner === 'draw') return 'PENALTY_WIN'

  const isClose = powerDiff < 5
  const isDominant = powerDiff > 15

  if (isDominant) {
    const options: BattleResultSummary[] = ['GOAL_SCORED', 'COUNTERATTACK_WIN', 'FREEKICK_WIN']
    return options[Math.floor(Math.random() * options.length)]
  }

  if (isClose) {
    const options: BattleResultSummary[] = ['GOAL_SCORED', 'SAVE_MADE', 'PENALTY_WIN', 'HEADER_WIN']
    return options[Math.floor(Math.random() * options.length)]
  }

  return 'GOAL_SCORED'
}

// ─── 1v1 Battle ───────────────────────────────────────────────────────────────

export function resolveSingleBattle(
  p1Card: { card: Card; userCard: UserCard },
  p2Card: { card: Card; userCard: UserCard },
  player1Id: string,
  player2Id: string,
): BattleResult {
  const p1Power = computeCardPower(p1Card.card, p1Card.userCard, 'generic')
  const p2Power = computeCardPower(p2Card.card, p2Card.userCard, 'generic')

  const powerDiff = Math.abs(p1Power - p2Power)
  let winner: 1 | 2 | 'draw'

  if (Math.abs(p1Power - p2Power) < 1) {
    winner = 'draw'
  } else {
    winner = p1Power > p2Power ? 1 : 2
  }

  const winnerId = winner === 'draw' ? null : winner === 1 ? player1Id : player2Id
  const resultSummary = selectResultSummary(winner, powerDiff)
  const isWinner = winnerId === player1Id

  return {
    battleId: '', // populated by caller
    winnerId,
    player1Power: Math.round(p1Power * 10) / 10,
    player2Power: Math.round(p2Power * 10) / 10,
    resultSummary,
    xpGained: isWinner ? ECONOMY.XP_BATTLE_WIN : ECONOMY.XP_BATTLE_LOSS,
    coinsGained: isWinner ? ECONOMY.COINS_BATTLE_WIN : ECONOMY.COINS_BATTLE_LOSS,
    energySpent: CARD_ENERGY.ENERGY_PER_BATTLE,
    isDraw: winner === 'draw',
  }
}

// ─── 3v3 Team Battle ──────────────────────────────────────────────────────────

export function resolveTeamBattle(
  p1Cards: Array<{ card: Card; userCard: UserCard }>,
  p2Cards: Array<{ card: Card; userCard: UserCard }>,
  player1Id: string,
  player2Id: string,
): BattleResult {
  const p1Power = computeTeamPower(p1Cards)
  const p2Power = computeTeamPower(p2Cards)

  const powerDiff = Math.abs(p1Power - p2Power)
  let winner: 1 | 2 | 'draw'

  if (powerDiff < 1.5) {
    winner = 'draw'
  } else {
    winner = p1Power > p2Power ? 1 : 2
  }

  const winnerId = winner === 'draw' ? null : winner === 1 ? player1Id : player2Id
  const resultSummary = selectResultSummary(winner, powerDiff)
  const isWinner = winnerId === player1Id

  return {
    battleId: '',
    winnerId,
    player1Power: Math.round(p1Power * 10) / 10,
    player2Power: Math.round(p2Power * 10) / 10,
    resultSummary,
    xpGained: isWinner ? ECONOMY.XP_BATTLE_WIN : ECONOMY.XP_BATTLE_LOSS,
    coinsGained: isWinner ? ECONOMY.COINS_BATTLE_WIN : ECONOMY.COINS_BATTLE_LOSS,
    energySpent: CARD_ENERGY.ENERGY_PER_BATTLE,
    isDraw: winner === 'draw',
  }
}

// ─── XP → Level ───────────────────────────────────────────────────────────────

export function xpToLevel(xp: number): number {
  const base = 200
  const exp = 1.4
  let level = 1
  let threshold = 0
  while (xp >= threshold + base * Math.pow(level, exp)) {
    threshold += base * Math.pow(level, exp)
    level++
  }
  return level
}

export function xpForNextLevel(level: number): number {
  return Math.floor(200 * Math.pow(level, 1.4))
}

export function xpProgressToNextLevel(xp: number): { current: number; needed: number; pct: number } {
  const base = 200
  const exp = 1.4
  let level = 1
  let threshold = 0
  while (xp >= threshold + base * Math.pow(level, exp)) {
    threshold += base * Math.pow(level, exp)
    level++
  }
  const needed = Math.floor(base * Math.pow(level, exp))
  const current = Math.floor(xp - threshold)
  return { current, needed, pct: Math.min((current / needed) * 100, 100) }
}
