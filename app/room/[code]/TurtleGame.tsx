'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { PROBLEMS } from '@/lib/turtle-data'
import type { RoomState, TurtleState, QAEntry } from '@/lib/types'

const ROUND_SEC = 300

interface Props {
  myId: string; room: RoomState; state: TurtleState | null; isHost: boolean
  bcTurtle: (s: TurtleState) => void
  sendAction: (type: string, data?: Record<string, unknown>) => void
  onBackLobby: () => void; onAddScore: (scores: Record<string, number>) => void
  onLeave: () => void
  bcRoom: (s: RoomState) => void
}

export default function TurtleGame({ myId, room, state, isHost, bcTurtle, sendAction, onBackLobby, onLeave }: Props) {
  const [tl, setTl] = useState(0)
  const [qi, setQi] = useState('')
  const [gi, setGi] = useState('')
  const [showAns, setShowAns] = useState(false)
  const [guessBox, setGuessBox] = useState(false)
  const [selectingNarrator, setSelectingNarrator] = useState(false)
  const logEnd = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef<TurtleState | null>(null)
  stateRef.current = state

  const tick = useCallback((n: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTl(n)
    timerRef.current = setInterval(() => setTl(p => { if (p <= 1) { clearInterval(timerRef.current!); return 0 }; return p - 1 }), 1000)
  }, [])

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [state?.qaLog.length])
  useEffect(() => { if (state?.timerEnd && state.timerEnd > Date.now()) tick(Math.ceil((state.timerEnd - Date.now()) / 1000)) }, [state?.timerEnd])

  useEffect(() => {
    if (!isHost || !state || tl !== 0 || state.phase !== 'playing' || state.solved) return
    bcTurtle({ ...state, phase: 'end' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl])

  const startWithProblem = useCallback((problemId: string, narratorId: string, usedIds: string[]) => {
    if (!isHost) return
    const prob = PROBLEMS.find(p => p.id === problemId); if (!prob) return
    const ns: TurtleState = {
      phase: 'playing', narratorId,
      usedProblemIds: [...usedIds, problemId],
      problemId: prob.id, situation: prob.situation,
      fullStory: prob.answer, keywords: prob.keywords,
      hints: prob.hints, revealedHints: [], hintVotes: {},
      qaLog: [], attempts: [], solved: false, solverName: '',
      timerEnd: Date.now() + ROUND_SEC * 1000,
      round: (state?.round ?? 0) + 1,
    }
    bcTurtle(ns); tick(ROUND_SEC)
  }, [isHost, state?.round, bcTurtle, tick])

  const processAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHost) return
    const s = stateRef.current; if (!s) return

    if (type === 'TT_ASK') {
      const asker = room.players.find(p => p.id === from); if (!asker) return
      const e: QAEntry = { id: Math.random().toString(36).slice(2, 9), playerId: from, playerName: asker.name, question: data.q as string, answer: 'pending' }
      bcTurtle({ ...s, qaLog: [...s.qaLog, e] }); return
    }
    if (type === 'TT_ANS' && from === s.narratorId) {
      bcTurtle({ ...s, qaLog: s.qaLog.map(e => e.id === data.id ? { ...e, answer: data.a as QAEntry['answer'] } : e) }); return
    }
    if (type === 'TT_REQ_HINT') {
      if (s.revealedHints.length >= 3 || Object.keys(s.hintVotes).length > 0) return
      const nv = { ...s.hintVotes, [from]: true }
      if (Object.keys(nv).length > Math.floor(room.players.length / 2)) {
        const hint = s.hints[s.revealedHints.length]
        if (hint) bcTurtle({ ...s, revealedHints: [...s.revealedHints, hint], hintVotes: {} })
      } else { bcTurtle({ ...s, hintVotes: nv }) }
      return
    }
    if (type === 'TT_GUESS') {
      const guesser = room.players.find(p => p.id === from); if (!guesser) return
      const guess = (data.g as string).trim()
      const ok = s.keywords.some(k => guess.toLowerCase().includes(k.toLowerCase()))
      const att = { playerName: guesser.name, guess, correct: ok }
      if (ok) bcTurtle({ ...s, solved: true, solverName: guesser.name, attempts: [...s.attempts, att], phase: 'end' })
      else bcTurtle({ ...s, attempts: [...s.attempts, att] })
      return
    }
  }, [isHost, bcTurtle, room.players])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__turtleActionHandler = processAction
    return () => { delete (window as any).__turtleActionHandler }
  }, [processAction])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const aLabel = (a: QAEntry['answer']) => {
    if (a === 'yes') return { text: '✅ 예', cls: 'text-green-400' }
    if (a === 'no') return { text: '❌ 아니오', cls: 'text-red-400' }
    if (a === 'irrelevant') return { text: '➖ 무관', cls: 'text-yellow-400' }
    return { text: '⏳', cls: 'text-white/30' }
  }

  const isNarrator = state?.narratorId === myId
  const usedIds = state?.usedProblemIds ?? []

  // ── 준비: 진행자 선택 ──
  if (!state || state.phase === 'select') {
    // 진행자가 문제 고르는 화면 (narratorId 이미 있을 때)
    if (state?.phase === 'select' && isNarrator) return (
      <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-10 pb-8 gap-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold">🐢 문제 선택</div>
          <button className="text-white/30 text-xs" onClick={onLeave}>나가기</button>
        </div>
        <div className="text-white/50 text-sm">출제할 문제를 고르세요</div>
        <div className="flex flex-col gap-3 overflow-y-auto">
          {PROBLEMS.map((prob, i) => {
            const used = usedIds.includes(prob.id)
            return (
              <button key={prob.id} disabled={used}
                onClick={() => startWithProblem(prob.id, state.narratorId, usedIds)}
                className={`w-full text-left rounded-2xl px-4 py-3 border transition active:scale-[0.98] ${used ? 'bg-white/3 border-white/5 opacity-40' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="text-white/40 text-xs mb-1">문제 {i + 1} {used && <span className="text-yellow-400">✓ 사용됨</span>}</div>
                    <div className="text-white text-sm">{prob.situation.slice(0, 40)}...</div>
                  </div>
                  {!used && <div className="text-white/30 shrink-0">→</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )

    // 진행자 아닌 사람 대기 화면
    if (state?.phase === 'select' && !isNarrator) return (
      <div className="min-h-screen bg-[#08080e] flex flex-col items-center justify-center px-5 gap-5">
        <div className="text-3xl font-black text-white">🐢 바다거북스프</div>
        <div className="text-white/40 text-sm animate-pulse">진행자가 문제를 고르는 중...</div>
        <button className="text-white/20 text-sm mt-8" onClick={onLeave}>나가기</button>
      </div>
    )

    // 아직 게임 안 시작 (진행자 선택 전)
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
        <div className="text-3xl font-black text-white">🐢 바다거북스프</div>
        <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4 text-sm text-white/60 flex flex-col gap-1 w-full max-w-sm">
          <div className="font-bold text-purple-300 mb-1">📖 규칙</div>
          <div>• 진행자 1명이 전체 스토리를 알고 있습니다</div>
          <div>• 나머지는 예/아니오 질문으로 추리하세요</div>
          <div>• 5분 안에 정답을 맞혀야 합니다</div>
        </div>
        {isHost && !selectingNarrator && (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button className="bg-purple-600 rounded-xl py-4 text-white font-bold text-lg active:scale-95 transition w-full" onClick={() => setSelectingNarrator(true)}>진행자 선택하기</button>
            <button className="text-white/20 text-sm text-center py-2" onClick={onBackLobby}>← 게임 목록으로</button>
          </div>
        )}
        {isHost && selectingNarrator && (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <div className="text-white/60 text-sm text-center">진행자를 선택하세요</div>
            {room.players.map(p => (
              <button key={p.id} onClick={() => {
                setSelectingNarrator(false)
                const ns: TurtleState = {
                  phase: 'select', narratorId: p.id, usedProblemIds: state?.usedProblemIds ?? [],
                  problemId: '', situation: '', fullStory: '', keywords: [],
                  hints: ['','',''], revealedHints: [], hintVotes: {},
                  qaLog: [], attempts: [], solved: false, solverName: '',
                  timerEnd: 0, round: state?.round ?? 0,
                }
                bcTurtle(ns as unknown as TurtleState)
              }}
                className="bg-white/5 border border-white/10 rounded-xl py-3 text-white font-bold active:scale-95 transition w-full">
                {p.name} {p.id === myId ? '(나)' : ''}
              </button>
            ))}
            <button className="text-white/30 text-sm py-2 text-center" onClick={() => setSelectingNarrator(false)}>← 뒤로</button>
          </div>
        )}
        {!isHost && <div className="text-white/30 text-sm">방장이 진행자를 선택 중...</div>}
        <button className="text-white/20 text-sm mt-4" onClick={onLeave}>나가기</button>
      </div>
    )
  }

  // ── 게임 중 ──
  if (state.phase === 'playing') {
    const pendingQs = state.qaLog.filter(e => e.answer === 'pending')
    const hvc = Object.keys(state.hintVotes).length
    const r3 = state.qaLog.slice(-3)
    const mono = r3.length >= 3 && r3.every(q => q.playerId === myId) && !isNarrator
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col px-4 pt-4 pb-4 gap-3 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold text-sm">🐢 바다거북스프</div>
          <div className="flex items-center gap-3">
            <div className={`text-xl font-black tabular-nums ${tl < 60 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{fmt(tl)}</div>
            <button className="text-white/20 text-xs" onClick={onLeave}>나가기</button>
          </div>
        </div>
        <div className="text-white/40 text-xs text-center">진행자: <span className="text-purple-300 font-bold">{room.players.find(p => p.id === state.narratorId)?.name}</span></div>

        <div className="bg-white/5 border border-purple-500/20 rounded-2xl p-4">
          <div className="text-purple-300 text-xs font-bold mb-2">📋 상황</div>
          <div className="text-white text-sm leading-relaxed">{state.situation}</div>
        </div>

        {isNarrator && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3">
            <div className="text-red-300 text-xs font-bold mb-1">🔒 진행자 전용</div>
            <div className="text-white/80 text-sm leading-relaxed">{state.fullStory}</div>
          </div>
        )}

        {state.revealedHints.map((h, i) => (
          <div key={i} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2 text-yellow-200 text-sm">💡 힌트 {i + 1}: {h}</div>
        ))}

        {Object.keys(state.hintVotes).length > 0 && state.revealedHints.length < 3 && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3 flex flex-col gap-2">
            <div className="text-yellow-200 text-sm">💡 힌트 요청 ({hvc}/{Math.floor(room.players.length / 2) + 1}명 동의)</div>
            {!state.hintVotes[myId] && !isNarrator && (
              <button className="bg-yellow-600 rounded-lg py-2 text-white text-sm font-bold active:scale-95 transition" onClick={() => sendAction('TT_REQ_HINT')}>동의</button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto flex flex-col gap-2 min-h-[160px] max-h-[280px]">
          {state.qaLog.length === 0
            ? <div className="text-white/20 text-sm text-center py-8">질문을 입력하세요</div>
            : state.qaLog.map(e => {
                const { text, cls } = aLabel(e.answer)
                return (
                  <div key={e.id} className="rounded-xl p-3 bg-white/5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1"><span className="text-purple-300 text-xs">{e.playerName}: </span><span className="text-white text-sm">{e.question}</span></div>
                      <div className={`text-xs font-bold shrink-0 ${cls}`}>{text}</div>
                    </div>
                    {e.answer === 'pending' && isNarrator && (
                      <div className="flex gap-2 mt-2">
                        {(['yes','no','irrelevant'] as const).map(a => (
                          <button key={a} onClick={() => sendAction('TT_ANS', { id: e.id, a })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition ${a==='yes'?'bg-green-600/60 text-green-100':a==='no'?'bg-red-600/60 text-red-100':'bg-yellow-600/60 text-yellow-100'}`}>
                            {a==='yes'?'✅ 예':a==='no'?'❌ 아니오':'➖ 무관'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
          <div ref={logEnd} />
        </div>

        {state.attempts.filter(a => !a.correct).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {state.attempts.filter(a => !a.correct).map((a, i) => (
              <span key={i} className="text-red-400/60 text-xs bg-red-500/10 rounded-full px-2 py-0.5">❌ {a.playerName}: {a.guess}</span>
            ))}
          </div>
        )}

        {mono && <div className="text-yellow-400 text-xs text-center">다른 사람에게 질문 기회를 양보해 주세요!</div>}
        {isNarrator && pendingQs.length > 0 && (
          <div className="bg-purple-900/20 rounded-xl px-3 py-2 text-purple-300 text-xs">⬆ 위 질문에 답해주세요 ({pendingQs.length}개)</div>
        )}

        {!isNarrator && (
          <>
            <div className="flex gap-2">
              <input className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 outline-none text-sm"
                placeholder="예/아니오로 답할 수 있는 질문" value={qi}
                onChange={e => setQi(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter'&&qi.trim()&&!mono){sendAction('TT_ASK',{q:qi.trim()});setQi('')} }}
                maxLength={60} />
              <button className="bg-purple-600 rounded-xl px-4 text-white font-bold text-sm active:scale-95 transition disabled:opacity-40"
                disabled={!qi.trim()||mono} onClick={() => {sendAction('TT_ASK',{q:qi.trim()});setQi('')}}>질문</button>
            </div>
            <div className="flex gap-2">
              {state.revealedHints.length < 3 && Object.keys(state.hintVotes).length === 0 && (
                <button className="flex-1 bg-yellow-600/20 border border-yellow-500/30 rounded-xl py-2.5 text-yellow-300 text-sm active:scale-95 transition"
                  onClick={() => sendAction('TT_REQ_HINT')}>💡 힌트 ({state.revealedHints.length}/3)</button>
              )}
              <button className="flex-1 bg-green-600/20 border border-green-500/30 rounded-xl py-2.5 text-green-300 text-sm active:scale-95 transition"
                onClick={() => setGuessBox(true)}>🎯 정답 선언</button>
            </div>
          </>
        )}

        {guessBox && (
          <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 pb-6 px-4">
            <div className="bg-[#14141f] rounded-2xl p-5 w-full max-w-sm flex flex-col gap-3 border border-white/10">
              <div className="text-white font-bold text-center">🎯 정답 선언</div>
              <input className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-sm text-center"
                placeholder="핵심 키워드 입력" value={gi} onChange={e => setGi(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter'&&gi.trim()){sendAction('TT_GUESS',{g:gi.trim()});setGi('');setGuessBox(false)} }}
                maxLength={40} autoFocus />
              <div className="flex gap-2">
                <button className="flex-1 bg-white/5 rounded-xl py-3 text-white/40 active:scale-95 transition" onClick={() => setGuessBox(false)}>취소</button>
                <button className="flex-1 bg-green-600 rounded-xl py-3 text-white font-bold active:scale-95 transition disabled:opacity-40"
                  disabled={!gi.trim()} onClick={() => {sendAction('TT_GUESS',{g:gi.trim()});setGi('');setGuessBox(false)}}>선언!</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── 종료 ──
  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
      <div className="text-3xl font-black text-white">{state.solved ? '🎉 정답!' : '⏰ 시간 초과'}</div>
      {state.solved && <div className="text-purple-300 text-sm"><span className="text-white font-bold">{state.solverName}</span>이 맞혔습니다!</div>}
      <div className="w-full max-w-sm">
        {!showAns
          ? <button className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 text-white/60 text-sm active:scale-95 transition" onClick={() => setShowAns(true)}>정답 확인하기 👇</button>
          : <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-3">
              <div className="text-purple-300 font-bold text-sm">상황</div><div className="text-white/60 text-sm">{state.situation}</div>
              <div className="text-purple-300 font-bold text-sm mt-2">정답</div><div className="text-white text-sm leading-relaxed">{state.fullStory}</div>
            </div>}
      </div>
      {isHost && (
        <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
          <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition w-full"
            onClick={() => { setShowAns(false); setSelectingNarrator(true);
              const ns: TurtleState = { ...state, phase: 'select', problemId: '', situation: '', fullStory: '', keywords: [], hints: ['','',''], revealedHints: [], hintVotes: {}, qaLog: [], attempts: [], solved: false, solverName: '', timerEnd: 0 }
              bcTurtle(ns)
            }}>다음 문제</button>
          <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50 active:scale-95 transition w-full" onClick={onBackLobby}>다른 게임 하기</button>
        </div>
      )}
      {!isHost && <div className="text-white/30 text-sm">방장이 다음을 선택 중...</div>}
      <button className="text-white/20 text-sm mt-2" onClick={onLeave}>나가기</button>
    </div>
  )
}
