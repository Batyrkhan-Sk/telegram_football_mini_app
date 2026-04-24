// ─── Card Types ────────────────────────────────────────────────────────────────

export type CardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface CardStats {
  speed: number
  shot: number
  dribbling: number
  physical: number
  defense: number
}

export interface Card {
  id: string
  playerName: string
  rarity: CardRarity
  club: string
  position: Position
  imageUrl: string
  isCustom: boolean
  stats: CardStats
  createdAt: string
}

export interface UserCard {
  id: string
  cardId: string
  card: Card
  energy: number
  maxEnergy: number
  cooldownEndAt: string | null
  timesUsed: number
  acquiredAt: string
  isExhausted: boolean
  isOnCooldown: boolean
}

// ─── Player / Profile ──────────────────────────────────────────────────────────

export interface PlayerProfile {
  id: string
  userId: string
  xp: number
  level: number
  coins: number
  battlesPlayed: number
  battlesWon: number
  qrScansUsed: number
  arSessionsPlayed: number
  arCooldownEnd: string | null
}

export interface UserWithProfile {
  id: string
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  profile: PlayerProfile
}

// ─── Character ─────────────────────────────────────────────────────────────────

export interface Character {
  id: string
  userId: string
  nickname: string
  hairstyle: string
  faceType: string
  skinTone: string
  jerseyStyle: string
  dominantAttr: string
  animeMode: boolean
  stats: CardStats
  createdAt: string
}

// ─── Battle ────────────────────────────────────────────────────────────────────

export type BattleFormat = 'ONE_V_ONE' | 'THREE_V_THREE'
export type BattleStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type BattleResultSummary =
  | 'GOAL_SCORED'
  | 'SAVE_MADE'
  | 'COUNTERATTACK_WIN'
  | 'PENALTY_WIN'
  | 'HEADER_WIN'
  | 'FREEKICK_WIN'

export interface BattleResult {
  battleId: string
  winnerId: string | null
  player1Power: number
  player2Power: number
  resultSummary: BattleResultSummary
  xpGained: number
  coinsGained: number
  energySpent: number
  isDraw: boolean
}

export interface Battle {
  id: string
  format: BattleFormat
  status: BattleStatus
  player1: UserWithProfile
  player2: UserWithProfile | null
  winnerId: string | null
  resultSummary: string | null
  xpGained: number
  coinsGained: number
  createdAt: string
  resolvedAt: string | null
}

// ─── Challenge ─────────────────────────────────────────────────────────────────

export type ChallengeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

export interface Challenge {
  id: string
  senderId: string
  sender: UserWithProfile
  receiverId: string | null
  format: BattleFormat
  status: ChallengeStatus
  deepLinkToken: string
  expiresAt: string
  createdAt: string
  battleId: string | null
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string | null
  firstName: string | null
  avatarUrl: string | null
  xp: number
  level: number
  battlesWon: number
  isCurrentUser?: boolean
}

// ─── QR / Promo ────────────────────────────────────────────────────────────────

export type RewardType = 'CARD_RESTORE' | 'AR_COOLDOWN_BYPASS' | 'BONUS_COINS' | 'BONUS_XP'

export interface PromoRedemptionResult {
  success: boolean
  rewardType: RewardType
  rewardValue: number
  message: string
}

// ─── AR Mode ──────────────────────────────────────────────────────────────────

export interface ArSessionResult {
  goalsScored: number
  totalShots: number
  success: boolean
  xpGained: number
  coinsGained: number
  cooldownSet: boolean
}

// ─── API Responses ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}
