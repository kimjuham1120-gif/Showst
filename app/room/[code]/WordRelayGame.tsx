'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CATEGORIES, pickQuestion, type Category } from '@/lib/wordrelay-data'
import type { RoomState, WordRelayState, WordRelayTeam, TeamConfig } from '@/lib/types'

interface Props {
  myId: string; room: RoomState; state: WordRelayState | null; isHost: boolean
  bcWordRelay: (s: WordRelayState) => void
  sendAction: (type: string, data?: Record<string, unknown>) => void
  onBackLobby: () => void; onAddScore: (scores: Record<string, number>) => void
  onLeave: () => void; bcRoom: (s: RoomState) => void
}

const TEAM_CONFIGS: { key: TeamConfig; label: string; teams: number }[] = [
  { key: '2vs2', label: '2 : 2', teams: 2 },
  { key: '3vs3', label: '3 : 3', teams: 2 },
  { key: '4vs4', label: '4 : 4', teams: 2 },
  { key: '3vs3vs3', label: '3 : 3 : 3', teams: 3 },
]

export default function WordRelayGame({ myId, room, state, isHost, bcWordRelay, sendAction, onBackLobby, onAddScore, onLeave }: Props) {
  const [selectedConfig, setSelectedConfig] = useState<TeamConfig>('2vs2')
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체')
  const [teamAssign, setTeamAssign] = useState<Record<string, string>>({})
  const [setupStep, setSetupStep] = useState<'config' | 'assign' | 'category'>('config')
  const [charInput, setCharInput] = useState('')

  // 호스트만 로컬로 정답 보관
  const localAnswer = useRef<string>('')
  const stateRef = useRef<WordRelayState | null>(null)
  stateRef.current = state

  const myTeam = state?.teams.find(t => t.playerIds.includes(myId))
  const myTeamProgress = myTeam ? state?.teamProgress[myTeam.id] : null
  const myCharIdx = myTeamProgress?.chars.length ?? 0
  const isMyInputTurn = !!(myTeam && !myTeamProgress?.done && !myTeamProgress?.failed
    && myTeam.playerIds[myCharIdx % myTeam.playerIds.length] === myId)

  const processAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHost) return
    const s = stateRef.current; if (!s) return

    if (type === 'RELAY_START') {
      const teams = data.teams as WordRelayTeam[]
      const category = data.category as Category
      const usedIds = s.usedIds ?? []
      const q = pickQuestion(usedIds, category)
      if (!q) { bcWordRelay({ ...s, phase: 'result', answer: '문제 소진', question: '모든 문제를 다 풀었어요!', winnerId: '' }); return }
      localAnswer.current = q.answer
      const progress: WordRelayState['teamProgress'] = {}
      teams.forEach(t => { progress[t.id] = { chars: [], done: false, failed: false } })
      bcWordRelay({
        ...s, phase: 'playing', teams,
        usedIds: [...usedIds, q.id],
        questionId: q.id, question: q.question,
        answer: '',   // 플레이어에게 빈 값
        teamProgress: progress, winnerId: '',
        round: s.round + 1,
      })
      return
    }

    if (type === 'RELAY_NEXT') {
      // 다음 문제
      const category = data.category as Category
      const q = pickQuestion(s.usedIds ?? [], category)
      if (!q) { bcWordRelay({ ...s, phase: 'result', answer: '문제 소진', question: '모든 문제를 다 풀었어요!', winnerId: '' }); return }
      localAnswer.current = q.answer
      const progress: WordRelayState['teamProgress'] = {}
      s.teams.forEach(t => { progress[t.id] = { chars: [], done: false, failed: false } })
      bcWordRelay({
        ...s, phase: 'playing',
        usedIds: [...(s.usedIds ?? []), q.id],
        questionId: q.id, question: q.question,
        answer: '', teamProgress: progress, winnerId: '',
        round: s.round + 1,
      })
      return
    }

    if (type === 'RELAY_CHAR') {
      const team = s.teams.find(t => t.playerIds.includes(from)); if (!team) return
      const prog = s.teamProgress[team.id]; if (!prog || prog.done || prog.failed) return
      const answerChars = localAnswer.current.split('')
      const expected = answerChars[prog.chars.length]
      const char = (data.c as string).trim()
      const correct = char === expected
      const newChars = [...prog.chars, char]
      const done = correct && newChars.length === answerChars.length
      const failed = !correct
      const newProgress = { ...s.teamProgress, [team.id]: { chars: newChars, done, failed } }

      if (done) {
        // 점수: 내가 맞힌 글자 수 - 상대 최대 맞힌 글자 수
        const otherMax = Math.max(0, ...s.teams.filter(t => t.id !== team.id).map(t => s.teamProgress[t.id]?.chars.length ?? 0))
        const score = Math.max(newChars.length - otherMax, 0)
        const scores: Record<string, number> = {}
        if (score > 0) team.playerIds.forEach(pid => { scores[pid] = score })
        if (Object.keys(scores).length > 0) onAddScore(scores)
        bcWordRelay({ ...s, teamProgress: newProgress, winnerId: team.id, phase: 'result', answer: localAnswer.current })
      } else {
        const allDone = s.teams.every(t => {
          const p = t.id === team.id ? newProgress[team.id] : s.teamProgress[t.id]
          return p.done || p.failed
        })
        if (allDone) {
          bcWordRelay({ ...s, teamProgress: newProgress, phase: 'result', answer: localAnswer.current, winnerId: '' })
        } else {
          bcWordRelay({ ...s, teamProgress: newProgress })
        }
      }
      return
    }
  }, [isHost, bcWordRelay, onAddScore])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__wordRelayActionHandler = processAction
    return () => { delete (window as any).__wordRelayActionHandler }
  }, [processAction])

  const startGame = () => {
    const cfg = TEAM_CONFIGS.find(c => c.key === selectedConfig)!
    const teams: WordRelayTeam[] = Array.from({ length: cfg.teams }, (_, i) => ({
      id: `team${i + 1}`, name: `팀 ${i + 1}`,
      playerIds: room.players.filter(p => teamAssign[p.id] === `team${i + 1}`).map(p => p.id),
      score: 0,
    }))
    // 초기 state 설정 후 START 액션
    const initState: WordRelayState = {
      phase: 'playing', round: 0,
      teamConfig: selectedConfig, teams,
      usedIds: [], questionId: '', question: '', answer: '',
      teamProgress: {}, winnerId: '',
    }
    bcWordRelay(initState)
    setTimeout(() => sendAction('RELAY_START', { teams, category: selectedCategory }), 100)
  }

  // ── 초기 설정 ──
  if (!state || state.phase === ('setup' as string)) return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
      <div className="text-3xl font-black text-white">🔤 단어 계주</div>
      <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4 text-sm text-white/60 flex flex-col gap-1 w-full max-w-sm">
        <div className="font-bold text-purple-300 mb-1">📖 규칙</div>
        <div>• 시스템이 문제를 자동 출제합니다</div>
        <div>• 팀원이 순서대로 정답의 글자를 하나씩 입력해요</div>
        <div>• 먼저 완성한 팀이 승리!</div>
        <div>• 점수 = 내 맞힌 글자 수 - 상대 맞힌 글자 수</div>
      </div>
      {isHost ? (
        <div className="w-full max-w-sm flex flex-col gap-4">
          {setupStep === 'config' && (
            <>
              <div className="text-white/60 text-sm">팀 구성 선택</div>
              {TEAM_CONFIGS.map(c => (
                <button key={c.key} onClick={() => setSelectedConfig(c.key)}
                  className={`w-full rounded-xl py-3 text-white font-bold active:scale-95 transition border ${selectedConfig === c.key ? 'bg-purple-600 border-purple-400' : 'bg-white/5 border-white/10'}`}>
                  {c.label}
                </button>
              ))}
              <button className="bg-purple-600 rounded-xl py-3 text-white font-bold active:scale-95 transition" onClick={() => setSetupStep('assign')}>다음 →</button>
            </>
          )}
          {setupStep === 'assign' && (
            <>
              <div className="text-white/60 text-sm">팀 배정</div>
              {room.players.map(p => {
                const cfg = TEAM_CONFIGS.find(c => c.key === selectedConfig)!
                return (
                  <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                    <span className="text-white">{p.name}</span>
                    <div className="flex gap-2">
                      {Array.from({ length: cfg.teams }, (_, i) => (
                        <button key={i} onClick={() => setTeamAssign(prev => ({ ...prev, [p.id]: `team${i + 1}` }))}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${teamAssign[p.id] === `team${i + 1}` ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/50'}`}>
                          팀{i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
              <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50" onClick={() => setSetupStep('config')}>← 뒤로</button>
              <button className="bg-purple-600 rounded-xl py-3 text-white font-bold active:scale-95 transition" onClick={() => setSetupStep('category')}>다음 →</button>
            </>
          )}
          {setupStep === 'category' && (
            <>
              <div className="text-white/60 text-sm">문제 카테고리</div>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setSelectedCategory(c)}
                  className={`w-full rounded-xl py-3 text-white font-bold active:scale-95 transition border ${selectedCategory === c ? 'bg-purple-600 border-purple-400' : 'bg-white/5 border-white/10'}`}>
                  {c}
                </button>
              ))}
              <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50" onClick={() => setSetupStep('assign')}>← 뒤로</button>
              <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition" onClick={startGame}>게임 시작!</button>
            </>
          )}
          <button className="text-white/20 text-sm text-center py-2" onClick={onBackLobby}>← 게임 목록으로</button>
        </div>
      ) : <div className="text-white/30 text-sm animate-pulse">방장이 설정 중...</div>}
      <button className="text-white/20 text-sm mt-4" onClick={onLeave}>나가기</button>
    </div>
  )

  // ── 로딩 (phase playing이지만 question 아직 없음) ──
  if (state.phase === 'playing' && !state.question) return (
    <div className="min-h-screen bg-[#08080e] flex items-center justify-center">
      <div className="text-white/40 animate-pulse">문제 준비 중...</div>
    </div>
  )

  // ── 게임 중 ──
  if (state.phase === 'playing') {
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold">🔤 단어 계주</div>
          <div className="flex items-center gap-3">
            <div className="text-white/40 text-xs">라운드 {state.round}</div>
            <button className="text-white/20 text-xs" onClick={onLeave}>나가기</button>
          </div>
        </div>

        {/* 문제 */}
        <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl px-5 py-5">
          <div className="text-purple-300 text-xs font-bold mb-2">❓ 문제</div>
          <div className="text-white text-lg font-bold leading-snug">{state.question}</div>
        </div>

        {/* 팀별 현황 */}
        {state.teams.map(team => {
          const prog = state.teamProgress[team.id]
          const isMyTeamCard = team.playerIds.includes(myId)
          const currentTurnIdx = prog.chars.length % team.playerIds.length
          const currentTurnName = !prog.done && !prog.failed
            ? room.players.find(p => p.id === team.playerIds[currentTurnIdx])?.name
            : null
          return (
            <div key={team.id} className={`rounded-2xl p-4 border ${isMyTeamCard ? 'bg-purple-600/10 border-purple-500/30' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-white font-bold text-sm">{team.name} {isMyTeamCard && '(내 팀)'}</div>
                {prog.done && <div className="text-green-400 text-xs font-bold">✅ 완성!</div>}
                {prog.failed && <div className="text-red-400 text-xs font-bold">❌ 실패</div>}
                {currentTurnName && <div className="text-purple-300 text-xs">{currentTurnName} 차례</div>}
              </div>
              {/* 맞힌 글자만 표시 */}
              <div className="flex gap-2 flex-wrap min-h-[40px]">
                {prog.chars.map((c, i) => (
                  <div key={i} className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-black border
                    ${prog.failed && i === prog.chars.length - 1
                      ? 'bg-red-600 border-red-400 text-white'
                      : 'bg-green-600 border-green-400 text-white'}`}>
                    {c}
                  </div>
                ))}
                {!prog.done && !prog.failed && (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white/20 border border-dashed border-white/20 text-lg">?</div>
                )}
              </div>
              <div className="text-white/30 text-xs mt-2">{team.playerIds.map(id => room.players.find(p => p.id === id)?.name).join(', ')}</div>
            </div>
          )
        })}

        {/* 내 입력 */}
        {isMyInputTurn && (
          <div className="mt-auto flex flex-col gap-2">
            <div className="text-white/40 text-xs text-center">{myCharIdx + 1}번째 글자를 입력하세요</div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/10 rounded-xl px-3 py-3 text-white outline-none text-center text-2xl font-black"
                placeholder="?"
                value={charInput}
                onChange={e => setCharInput(e.target.value.slice(-1))}
                onKeyDown={e => { if (e.key === 'Enter' && charInput) { sendAction('RELAY_CHAR', { c: charInput }); setCharInput('') } }}
                maxLength={1} autoFocus />
              <button
                className="bg-purple-600 rounded-xl px-5 text-white font-bold text-lg active:scale-95 transition disabled:opacity-40"
                disabled={!charInput}
                onClick={() => { sendAction('RELAY_CHAR', { c: charInput }); setCharInput('') }}>
                입력
              </button>
            </div>
          </div>
        )}
        {!isMyInputTurn && myTeam && !myTeamProgress?.done && !myTeamProgress?.failed && (
          <div className="text-white/30 text-sm text-center mt-auto animate-pulse">팀원 차례 대기 중...</div>
        )}
        {(myTeamProgress?.done || myTeamProgress?.failed) && (
          <div className={`text-center text-sm font-bold mt-auto ${myTeamProgress.done ? 'text-green-400' : 'text-red-400'}`}>
            {myTeamProgress.done ? '✅ 우리 팀 완성!' : '❌ 우리 팀 실패'}
          </div>
        )}
      </div>
    )
  }

  // ── 결과 ──
  const winner = state.teams.find(t => t.id === state.winnerId)
  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
      <div className="text-3xl font-black text-white">{winner ? `${winner.name} 승리! 🏆` : '전팀 실패'}</div>

      <div className="bg-white/5 rounded-2xl p-4 w-full max-w-sm flex flex-col gap-2">
        <div className="text-white/40 text-xs">문제</div>
        <div className="text-white text-sm">{state.question}</div>
        <div className="text-white/40 text-xs mt-1">정답</div>
        <div className="text-white font-black text-2xl tracking-widest">{state.answer}</div>
      </div>

      {/* 팀별 진행 결과 */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {state.teams.map(team => {
          const prog = state.teamProgress[team.id]
          return (
            <div key={team.id} className="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-sm">{team.name}</div>
                <div className="text-white/40 text-xs mt-0.5">{prog.chars.join('')} ({prog.chars.length}글자)</div>
              </div>
              {prog.done ? <span className="text-green-400 text-xs font-bold">✅ 완성</span> : <span className="text-red-400 text-xs font-bold">❌ 실패</span>}
            </div>
          )
        })}
      </div>

      {/* 점수 */}
      <div className="w-full max-w-sm flex flex-col gap-2">
        {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
          <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-white/5'}`}>
            <span className="text-white">{p.name}</span>
            <span className="text-purple-400 font-bold">{p.score}점</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
        {isHost && (
          <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition w-full"
            onClick={() => sendAction('RELAY_NEXT', { category: selectedCategory })}>
            다음 문제
          </button>
        )}
        {isHost && <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50 active:scale-95 transition w-full" onClick={onBackLobby}>다른 게임 하기</button>}
        {!isHost && <div className="text-white/30 text-sm text-center">방장이 선택 중...</div>}
        <button className="text-white/20 text-sm text-center py-2" onClick={onLeave}>나가기</button>
      </div>
    </div>
  )
}
