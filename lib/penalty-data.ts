export type PenaltyLevel = 1 | 2 | 3 | 4 | 5

export interface Penalty {
  id: string
  text: string
  level: PenaltyLevel
}

export const LEVEL_LABELS: Record<PenaltyLevel, string> = {
  1: '아주 약함',
  2: '약함',
  3: '중간',
  4: '강함',
  5: '아주 강함',
}

export const LEVEL_COLORS: Record<PenaltyLevel, string> = {
  1: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
  2: 'bg-green-500/20 border-green-500/30 text-green-300',
  3: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
  4: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
  5: 'bg-red-500/20 border-red-500/30 text-red-300',
}

// 실제 벌칙 리스트는 추후 추가
export const PENALTIES: Penalty[] = []
