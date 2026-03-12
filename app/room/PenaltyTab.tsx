'use client'
import { useState, useEffect } from 'react'
import { PENALTIES, LEVEL_LABELS, LEVEL_COLORS, type Penalty, type PenaltyLevel } from '@/lib/penalty-data'

const STORAGE_KEY = 'showst_penalty_favorites'

function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveFavorites(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* ignore */ }
}

export default function PenaltyTab() {
  const [levelFilter, setLevelFilter] = useState<PenaltyLevel | 'all'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'favorites'>('list')
  const [favorites, setFavorites] = useState<string[]>([])
  const [picked, setPicked] = useState<Penalty | null>(null)

  useEffect(() => { setFavorites(loadFavorites()) }, [])

  const toggleFav = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id]
    setFavorites(next); saveFavorites(next)
  }

  const filtered = PENALTIES.filter(p => {
    if (viewMode === 'favorites' && !favorites.includes(p.id)) return false
    if (levelFilter !== 'all' && p.level !== levelFilter) return false
    return true
  })

  const pickRandom = () => {
    if (filtered.length === 0) return
    setPicked(filtered[Math.floor(Math.random() * filtered.length)])
  }

  const levels: (PenaltyLevel | 'all')[] = ['all', 1, 2, 3, 4, 5]

  return (
    <div className="flex flex-col gap-4">
      {/* 탭 전환 */}
      <div className="flex gap-2">
        <button onClick={() => setViewMode('list')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>
          📋 전체
        </button>
        <button onClick={() => setViewMode('favorites')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${viewMode === 'favorites' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>
          ⭐ 즐겨찾기 {favorites.length > 0 && `(${favorites.length})`}
        </button>
      </div>

      {/* 강도 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {levels.map(l => (
          <button key={l} onClick={() => setLevelFilter(l)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${levelFilter === l ? 'bg-purple-600 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>
            {l === 'all' ? '전체' : LEVEL_LABELS[l]}
          </button>
        ))}
      </div>

      {/* 랜덤 뽑기 */}
      <button onClick={pickRandom} disabled={filtered.length === 0}
        className="w-full bg-purple-600 rounded-2xl py-4 text-white font-bold text-lg active:scale-95 transition disabled:opacity-30">
        🎲 랜덤 뽑기
      </button>

      {/* 뽑힌 벌칙 */}
      {picked && (
        <div className={`rounded-2xl p-5 border flex flex-col gap-2 ${LEVEL_COLORS[picked.level]}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold opacity-70">{LEVEL_LABELS[picked.level]}</div>
            <button onClick={() => toggleFav(picked.id)} className="text-lg">
              {favorites.includes(picked.id) ? '⭐' : '☆'}
            </button>
          </div>
          <div className="text-white text-base font-bold">{picked.text}</div>
        </div>
      )}

      {/* 벌칙 목록 */}
      {filtered.length === 0 ? (
        <div className="text-white/20 text-sm text-center py-10">
          {PENALTIES.length === 0 ? '벌칙 리스트 준비 중...' : '해당하는 벌칙이 없어요'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(p => (
            <button key={p.id} onClick={() => setPicked(p)}
              className={`w-full text-left rounded-xl px-4 py-3 border transition active:scale-[0.98] ${picked?.id === p.id ? LEVEL_COLORS[p.level] : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className={`text-xs font-bold mb-0.5 ${LEVEL_COLORS[p.level].split(' ').pop()}`}>{LEVEL_LABELS[p.level]}</div>
                  <div className="text-white text-sm">{p.text}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleFav(p.id) }} className="text-lg shrink-0">
                  {favorites.includes(p.id) ? '⭐' : '☆'}
                </button>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
