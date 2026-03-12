'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { pickTopic } from '@/lib/data'
import type { RoomState, LiarState } from '@/lib/types'

const SPEAK = 30, DISCUSS = 90, VOTE = 30, GUESS = 30

interface Props {
  myId: string; room: RoomState; state: LiarState | null; isHost: boolean
  bcLiar: (s: LiarState) => void; bcRoom: (s: RoomState) => void
  sendAction: (type: string, data?: Record<string, unknown>) => void
  onBackLobby: () => void; onAddScore: (scores: Record<string, number>) => void
  onLeave: () => void
}

export default function LiarGame({ myId, room, state, isHost, bcLiar, sendAction, onBackLobby, onAddScore, onLeave }: Props) {
  const [tl, setTl] = useState(0)
  const [guessInput, setGuessInput] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef<LiarState | null>(null)
  stateRef.current = state

  const tick = useCallback((n: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTl(n)
    timerRef.current = setInterval(() => setTl(p => { if (p <= 1) { clearInterval(timerRef.current!); return 0 }; return p - 1 }), 1000)
  }, [])

  const initGame = useCallback(() => {
    if (!isHost) return
    const { topic, word } = pickTopic()
    const sh = [...room.players].sort(() => Math.random() - .5)
    const ns: LiarState = {
      phase: 'speaking', liarId: sh[0].id, topic, word,
      speakOrder: sh.map(p => p.id), speakerIdx: 0,
      votes: {}, eliminatedId: '', liarGuess: '',
      timerEnd: Date.now() + SPEAK * 1000, round: (state?.round ?? 0) + 1,
    }
    bcLiar(ns); tick(SPEAK)
  }, [isHost, room.players, state?.round, bcLiar, tick])

  // 타임아웃 자동 처리 (호스트만)
  useEffect(() => {
    if (!isHost || !state || tl !== 0) return
    const s = state
    if (s.phase === 'speaking') sendAction('LIAR_NEXT')
    else if (s.phase === 'discussion') sendAction('LIAR_VOTE_START')
    else if (s.phase === 'voting') sendAction('LIAR_VOTE_TIMEOUT')
    else if (s.phase === 'liar_guess') sendAction('LIAR_GUESS_TIMEOUT')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl])

  // 타이머 동기화
  useEffect(() => {
    if (state?.timerEnd && state.timerEnd > Date.now()) {
      tick(Math.ceil((state.timerEnd - Date.now()) / 1000))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.timerEnd])

  // 액션 처리 (호스트만)
  const processAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHost) return
    const s = stateRef.current; if (!s) return

    if (type === 'LIAR_NEXT' && s.phase === 'speaking') {
      const nx = s.speakerIdx + 1
      if (nx >= s.speakOrder.length) {
        bcLiar({ ...s, phase: 'discussion', timerEnd: Date.now() + DISCUSS * 1000 }); tick(DISCUSS)
      } else {
        bcLiar({ ...s, speakerIdx: nx, timerEnd: Date.now() + SPEAK * 1000 }); tick(SPEAK)
      }
      return
    }
    if (type === 'LIAR_VOTE_START' && s.phase === 'discussion') {
      bcLiar({ ...s, phase: 'voting', votes: {}, timerEnd: Date.now() + VOTE * 1000 }); tick(VOTE); return
    }
    if ((type === 'LIAR_VOTE' || type === 'LIAR_VOTE_TIMEOUT') && s.phase === 'voting') {
      const votes = type === 'LIAR_VOTE' ? { ...s.votes, [from]: data.tid as string } : s.votes
      const ns = { ...s, votes }
      const allVoted = type === 'LIAR_VOTE_TIMEOUT' || Object.keys(votes).length >= s.speakOrder.length
      if (allVoted) {
        if (timerRef.current) clearInterval(timerRef.current)
        const tally: Record<string, number> = {}
        Object.values(votes).forEach(id => { tally[id] = (tally[id] || 0) + 1 })
        const max = Math.max(...Object.values(tally), 0)
        const top = Object.keys(tally).filter(id => tally[id] === max)
        const elim = top.length === 1 ? top[0] : ''
        if (elim === s.liarId) {
          bcLiar({ ...ns, eliminatedId: elim, phase: 'liar_guess', timerEnd: Date.now() + GUESS * 1000 }); tick(GUESS)
        } else {
          bcLiar({ ...ns, eliminatedId: elim, phase: 'result' })
        }
      } else {
        bcLiar(ns)
      }
      return
    }
    if (type === 'LIAR_GUESS' && s.phase === 'liar_guess' && from === s.liarId) {
      const ok = (data.g as string).trim().toLowerCase() === s.word.toLowerCase()
      if (timerRef.current) clearInterval(timerRef.current)
      bcLiar({ ...s, liarGuess: data.g as string, phase: 'result' })
      // 점수: 라이어 정답 → 라이어 +3, 시민 승리 → 시민 각 +1
      const scores: Record<string, number> = {}
      if (ok) { scores[s.liarId] = 3 }
      else { room.players.forEach(p => { if (p.id !== s.liarId) scores[p.id] = 1 }) }
      onAddScore(scores)
      return
    }
    if (type === 'LIAR_GUESS_TIMEOUT' && s.phase === 'liar_guess') {
      bcLiar({ ...s, phase: 'result' })
      room.players.forEach(p => { if (p.id !== s.liarId) onAddScore({ [p.id]: 1 }) })
      return
    }
  }, [isHost, bcLiar, tick, room.players, onAddScore])

  // 액션 수신
  useEffect(() => {
    const handler = (payload: { type: string; data: Record<string, unknown>; from: string }) => {
      processAction(payload.type, payload.data, payload.from)
    }
    // 방장만 처리 — sendAction으로 오는 liar 관련 이벤트를 방장이 처리
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__liarActionHandler = handler
    return () => { delete (window as any).__liarActionHandler }
  }, [processAction])

  if (!state) return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center justify-center px-5 gap-6">
      <div className="text-3xl font-black text-white">🤥 라이어 게임</div>
      <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4 text-sm text-white/60 flex flex-col gap-1 w-full max-w-sm">
        <div className="font-bold text-purple-300 mb-1">📖 규칙</div>
        <div>• 라이어는 제시어를 모릅니다</div>
        <div>• 발언 후 투표로 라이어를 찾아내세요</div>
        <div>• 라이어가 걸려도 단어를 맞히면 역전!</div>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3">
        {isHost
          ? <button className="bg-purple-600 rounded-xl py-4 text-white font-bold text-lg active:scale-95 transition w-full" onClick={initGame}>게임 시작</button>
          : <div className="text-white/30 text-sm text-center">방장이 시작하길 기다리는 중...</div>}
        <button className="text-white/20 text-sm text-center py-2" onClick={onBackLobby}>← 게임 목록으로</button>
      </div>
    </div>
  )

  const isLiar = state.liarId === myId
  const spkId = state.speakOrder[state.speakerIdx]
  const spkName = room.players.find(p => p.id === spkId)?.name
  const isMyTurn = spkId === myId
  const myVote = state.votes[myId]
  const maxTime = state.phase === 'speaking' ? SPEAK : state.phase === 'discussion' ? DISCUSS : state.phase === 'voting' ? VOTE : GUESS

  // 발언
  if (state.phase === 'speaking') return (
    <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4">
      <div className="flex justify-between items-center">
        <div className="text-white font-bold">🤥 발언 차례</div>
        <div className={`text-2xl font-black tabular-nums ${tl <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{tl}s</div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1"><div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${(tl / maxTime) * 100}%` }} /></div>

      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <div className="text-white/40 text-xs mb-1">주제</div>
        <div className="text-purple-300 font-bold text-lg">{state.topic}</div>
        <div className="mt-3 text-white/40 text-xs mb-1">내 단어</div>
        <div className="text-white font-black text-4xl">{isLiar ? '???' : state.word}</div>
        {isLiar && <div className="text-red-400 text-xs mt-2">👹 당신이 라이어!</div>}
      </div>

      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <div className="text-white/40 text-xs mb-1">지금 발언자</div>
        <div className="text-white font-bold text-xl">{spkName}</div>
        {isMyTurn && <div className="text-purple-300 text-sm mt-1">← 지금 내 차례!</div>}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {state.speakOrder.map((id, i) => {
          const p = room.players.find(pl => pl.id === id)
          return <div key={id} className={`rounded-xl px-3 py-1.5 text-sm ${i === state.speakerIdx ? 'bg-purple-600 text-white font-bold' : i < state.speakerIdx ? 'bg-white/5 text-white/30 line-through' : 'bg-white/5 text-white/60'}`}>{p?.name}</div>
        })}
      </div>
      {isHost && <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition mt-auto" onClick={() => sendAction('LIAR_NEXT')}>다음 →</button>}
    </div>
  )

  // 토론
  if (state.phase === 'discussion') return (
    <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4">
      <div className="flex justify-between items-center">
        <div className="text-white font-bold">🤥 자유 토론</div>
        <div className={`text-2xl font-black tabular-nums ${tl <= 20 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{tl}s</div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1"><div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${(tl / maxTime) * 100}%` }} /></div>
      <div className="bg-white/5 rounded-2xl p-4 text-center">
        <div className="text-white/40 text-xs mb-1">주제 / 내 단어</div>
        <div className="text-purple-300 font-bold">{state.topic}</div>
        <div className="text-white font-black text-3xl mt-1">{isLiar ? '???' : state.word}</div>
      </div>
      <div className="text-white/50 text-sm text-center py-4">자유롭게 대화하고 라이어를 찾아내세요!</div>
      {isHost && <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition mt-auto" onClick={() => sendAction('LIAR_VOTE_START')}>투표 시작</button>}
    </div>
  )

  // 투표
  if (state.phase === 'voting') return (
    <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4">
      <div className="flex justify-between items-center">
        <div className="text-white font-bold">🤥 투표</div>
        <div className={`text-2xl font-black tabular-nums ${tl <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{tl}s</div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1"><div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${(tl / maxTime) * 100}%` }} /></div>
      <div className="text-white/50 text-sm text-center">라이어라고 생각하는 사람을 선택하세요</div>
      <div className="text-white/30 text-xs text-center">{Object.keys(state.votes).length}/{room.players.length}명 완료</div>
      <div className="flex flex-col gap-3 mt-2">
        {room.players.filter(p => p.id !== myId).map(p => (
          <button key={p.id} disabled={!!myVote} onClick={() => sendAction('LIAR_VOTE', { tid: p.id })}
            className={`w-full rounded-2xl py-4 text-white font-bold text-lg active:scale-95 transition ${myVote === p.id ? 'bg-purple-600 border-2 border-purple-300' : myVote ? 'bg-white/5 opacity-40' : 'bg-white/10'}`}>
            {p.name}
          </button>
        ))}
      </div>
      {myVote && <div className="text-purple-300 text-sm text-center">투표 완료 — 기다리는 중...</div>}
    </div>
  )

  // 라이어 마지막 기회
  if (state.phase === 'liar_guess') {
    const elimName = room.players.find(p => p.id === state.eliminatedId)?.name
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
        <div className="text-3xl font-black text-white">라이어 적발!</div>
        <div className="text-white/50 text-sm text-center"><span className="text-red-400 font-bold">{elimName}</span>이 라이어로 지목됐습니다</div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-center w-full max-w-sm">
          <div className="text-red-300 text-sm font-bold mb-1">⚔️ 마지막 기회</div>
          <div className="text-white/60 text-sm">단어를 맞히면 역전!</div>
          <div className="text-white/40 text-xs mt-1">주제: <span className="text-purple-300">{state.topic}</span></div>
        </div>
        <div className="text-2xl font-black tabular-nums text-red-400 animate-pulse">{tl}s</div>
        {isLiar ? (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <input className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-center text-lg w-full"
              placeholder="단어를 맞혀보세요" value={guessInput} onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guessInput && sendAction('LIAR_GUESS', { g: guessInput.trim() })}
              maxLength={20} autoFocus />
            <button className="bg-red-600 rounded-xl py-3 text-white font-bold active:scale-95 transition disabled:opacity-40 w-full"
              disabled={!guessInput} onClick={() => sendAction('LIAR_GUESS', { g: guessInput.trim() })}>
              선언!
            </button>
          </div>
        ) : (
          <div className="text-white/30 text-sm animate-pulse">라이어가 단어를 고민 중...</div>
        )}
      </div>
    )
  }

  // 결과
  if (state.phase === 'result') {
    const liarName = room.players.find(p => p.id === state.liarId)?.name
    const caught = state.eliminatedId === state.liarId
    const right = state.liarGuess && state.liarGuess.toLowerCase() === state.word.toLowerCase()
    const liarWin = !caught || right
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-10 pb-8 gap-5">
        <div className="text-3xl font-black text-white">결과</div>
        <div className={`text-lg font-bold ${liarWin ? 'text-red-400' : 'text-green-400'}`}>
          {!caught ? '라이어 탈출! 🎭' : right ? '라이어 역전! 🎊' : '시민 승리! ✅'}
        </div>
        <div className="bg-white/5 rounded-2xl p-4 w-full max-w-sm flex flex-col gap-1">
          <div className="text-white/40 text-xs">라이어: <span className="text-red-400 font-bold">{liarName}</span></div>
          <div className="text-white/40 text-xs">단어: <span className="text-purple-300 font-bold">{state.word}</span></div>
          {state.liarGuess && <div className="text-white/40 text-xs">라이어 추측: <span className="text-white">{state.liarGuess}</span></div>}
        </div>
        <div className="w-full max-w-sm flex flex-col gap-2">
          {[...room.players].sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-white/5'}`}>
              <div className="flex items-center gap-3">
                <span className="text-white/40 w-5">{i + 1}</span>
                <span className="text-white font-medium">{p.name}</span>
                {p.id === state.liarId && <span className="text-red-400 text-xs">라이어</span>}
              </div>
              <span className="text-purple-400 font-bold text-lg">{p.score}점</span>
            </div>
          ))}
        </div>
        <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
          {isHost && <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition w-full" onClick={initGame}>한 판 더</button>}
          <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50 active:scale-95 transition w-full" onClick={onBackLobby}>다른 게임 하기</button>
        </div>
      </div>
    )
  }

  return null
}
