import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserCard, UserWithProfile, Character } from '@/types'

// ─── User Store ────────────────────────────────────────────────────────────────

interface UserStore {
  user: UserWithProfile | null
  isLoading: boolean
  isOnboarded: boolean
  setUser: (user: UserWithProfile) => void
  updateProfile: (patch: Partial<UserWithProfile['profile']>) => void
  setLoading: (v: boolean) => void
  setOnboarded: () => void
  reset: () => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isOnboarded: false,
      setUser: (user) => set({ user }),
      updateProfile: (patch) =>
        set((state) => state.user
          ? { user: { ...state.user, profile: { ...state.user.profile, ...patch } } }
          : state
        ),
      setLoading: (v) => set({ isLoading: v }),
      setOnboarded: () => set({ isOnboarded: true }),
      reset: () => set({ user: null, isOnboarded: false }),
    }),
    { name: 'kairat-user', partialize: (s) => ({ isOnboarded: s.isOnboarded }) }
  )
)

// ─── Battle Store ──────────────────────────────────────────────────────────────

interface BattleStore {
  selectedCards: UserCard[]
  opponentId: string | null
  format: 'ONE_V_ONE' | 'THREE_V_THREE'
  selectCard: (card: UserCard) => void
  deselectCard: (cardId: string) => void
  setOpponent: (id: string | null) => void
  setFormat: (f: 'ONE_V_ONE' | 'THREE_V_THREE') => void
  clearSelection: () => void
}

export const useBattleStore = create<BattleStore>((set) => ({
  selectedCards: [],
  opponentId: null,
  format: 'ONE_V_ONE',
  selectCard: (card) =>
    set((state) => {
      const max = state.format === 'ONE_V_ONE' ? 1 : 3
      if (state.selectedCards.find((c) => c.id === card.id)) return state
      if (state.selectedCards.length >= max) return state
      return { selectedCards: [...state.selectedCards, card] }
    }),
  deselectCard: (cardId) =>
    set((state) => ({ selectedCards: state.selectedCards.filter((c) => c.id !== cardId) })),
  setOpponent: (id) => set({ opponentId: id }),
  setFormat: (f) => set({ format: f, selectedCards: [] }),
  clearSelection: () => set({ selectedCards: [], opponentId: null }),
}))

// ─── Character Store ───────────────────────────────────────────────────────────

interface CharacterDraft {
  nickname: string
  hairstyle: string
  faceType: string
  skinTone: string
  jerseyStyle: string
  dominantAttr: string
  animeMode: boolean
}

interface CharacterStore {
  draft: CharacterDraft
  savedCharacter: Character | null
  updateDraft: (patch: Partial<CharacterDraft>) => void
  setSavedCharacter: (c: Character) => void
  resetDraft: () => void
}

const DEFAULT_DRAFT: CharacterDraft = {
  nickname: '',
  hairstyle: 'style1',
  faceType: 'face1',
  skinTone: 'tone2',
  jerseyStyle: 'jersey1',
  dominantAttr: 'speed',
  animeMode: false,
}

export const useCharacterStore = create<CharacterStore>()(
  persist(
    (set) => ({
      draft: DEFAULT_DRAFT,
      savedCharacter: null,
      updateDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
      setSavedCharacter: (c) => set({ savedCharacter: c }),
      resetDraft: () => set({ draft: DEFAULT_DRAFT }),
    }),
    { name: 'kairat-character' }
  )
)

// ─── AR Mode Store ─────────────────────────────────────────────────────────────

interface ArStore {
  sessionActive: boolean
  goalsScored: number
  shotsRemaining: number
  phase: 'idle' | 'aiming' | 'shooting' | 'result' | 'finished'
  startSession: () => void
  recordGoal: () => void
  recordMiss: () => void
  setPhase: (p: ArStore['phase']) => void
  resetSession: () => void
}

export const useArStore = create<ArStore>((set) => ({
  sessionActive: false,
  goalsScored: 0,
  shotsRemaining: 5,
  phase: 'idle',
  startSession: () => set({ sessionActive: true, goalsScored: 0, shotsRemaining: 5, phase: 'aiming' }),
  recordGoal: () => set((s) => ({ goalsScored: s.goalsScored + 1, shotsRemaining: s.shotsRemaining - 1 })),
  recordMiss: () => set((s) => ({ shotsRemaining: s.shotsRemaining - 1 })),
  setPhase: (phase) => set({ phase }),
  resetSession: () => set({ sessionActive: false, goalsScored: 0, shotsRemaining: 5, phase: 'idle' }),
}))
