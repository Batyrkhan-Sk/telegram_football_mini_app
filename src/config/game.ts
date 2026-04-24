// ─── Economy Config ────────────────────────────────────────────────────────────
// Centralised config for all game balance. Adjust here to rebalance.

export const ECONOMY = {
  // XP rewards
  XP_BATTLE_WIN: 80,
  XP_BATTLE_LOSS: 20,
  XP_AR_SUCCESS: 60,
  XP_AR_FAIL: 10,

  // Coin rewards
  COINS_BATTLE_WIN: 25,
  COINS_BATTLE_LOSS: 0,
  COINS_AR_SUCCESS: 15,
  COINS_AR_FAIL: 0,
  COINS_QR_BONUS_DEFAULT: 100,

  // Leveling: XP required = BASE * level^EXPONENT
  LEVEL_XP_BASE: 200,
  LEVEL_XP_EXPONENT: 1.4,
} as const

// ─── Card Energy ───────────────────────────────────────────────────────────────

export const CARD_ENERGY = {
  ENERGY_PER_BATTLE: 25,       // energy deducted per battle
  MAX_ENERGY: 100,
  RESTORE_COOLDOWN_HOURS: 72,  // auto-restore cooldown
} as const

// ─── AR Mode ──────────────────────────────────────────────────────────────────

export const AR_MODE = {
  SHOTS_PER_SESSION: 5,
  GOALS_TO_WIN: 3,
  SESSION_COOLDOWN_HOURS: 48,
} as const

// ─── Battle Engine Weights ─────────────────────────────────────────────────────

export const BATTLE_WEIGHTS = {
  // Attacker weights
  ATTACKER: { speed: 0.20, shot: 0.35, dribbling: 0.25, physical: 0.10, defense: 0.10 },
  // Defender weights
  DEFENDER: { speed: 0.15, shot: 0.10, dribbling: 0.15, physical: 0.25, defense: 0.35 },
  // GK weights
  GK: { speed: 0.10, shot: 0.05, dribbling: 0.10, physical: 0.30, defense: 0.45 },
  // Generic (1v1)
  GENERIC: { speed: 0.20, shot: 0.25, dribbling: 0.25, physical: 0.15, defense: 0.15 },
} as const

export const BATTLE_CONFIG = {
  RANDOM_VARIANCE: 0.15,       // ±15% random variance
  RARITY_MULTIPLIERS: {
    COMMON: 1.0,
    RARE: 1.08,
    EPIC: 1.16,
    LEGENDARY: 1.25,
  },
  ENERGY_LOW_PENALTY: 0.85,    // below 30% energy: 15% stat penalty
  TEAM_SYNERGY_BONUS: 0.05,    // 3v3: same club bonus
} as const

// ─── Rarity display config ─────────────────────────────────────────────────────

export const RARITY_CONFIG = {
  COMMON: {
    label: 'Common',
    color: '#9CA3AF',
    bgClass: 'bg-card-common',
    borderColor: 'border-gray-600',
    glowColor: 'rgba(156,163,175,0.3)',
  },
  RARE: {
    label: 'Rare',
    color: '#3B82F6',
    bgClass: 'bg-card-rare',
    borderColor: 'border-blue-500',
    glowColor: 'rgba(59,130,246,0.4)',
  },
  EPIC: {
    label: 'Epic',
    color: '#A855F7',
    bgClass: 'bg-card-epic',
    borderColor: 'border-purple-500',
    glowColor: 'rgba(168,85,247,0.4)',
  },
  LEGENDARY: {
    label: 'Legendary',
    color: '#F5C518',
    bgClass: 'bg-card-legendary',
    borderColor: 'border-yellow-400',
    glowColor: 'rgba(245,197,24,0.5)',
  },
} as const

export const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
}
