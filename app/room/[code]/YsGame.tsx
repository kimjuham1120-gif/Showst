'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { assignWords } from '@/lib/yangsechan-data'
import type { RoomState, YsState } from '@/lib/types'

const ASK_SEC = 30, VOTE_SEC = 15, GUESS_SEC = 30

interface Props {
  myId: string; room: RoomState; state: YsState | null; isHost: boolean
  bcYs: (s: YsState) => void; bcRoom: (s: RoomState) => void
  sendAction: (type: string, data?: Record<string, unknown>) => void
  onBackLobby: () => void; onAddScore: (scores: Record<string, number>) => void
  onLeave: () => void
}

export default function YsGame({ myId, room, state, isHost, bcYs, sendAction, onBackLobby, onAddScore, onLeave }: Props) {
  const [tl, setTl] = useState(0)
  const [qi, setQi] = useState('')
  const [gi, setGi] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef<YsState | null>(null)
  stateRef.current = state

  const tick = useCallback((n: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTl(n)
    timerRef.current = setInterval(() => setTl(p => { if (p <= 1) { clearInterval(timerRef.current!); return 0 }; return p - 1 }), 1000)
  }, [])

  useEffect(() => {
    if (state?.timerEnd && state.timerEnd > Date.now()) tick(Math.ceil((state.timerEnd - Date.now()) / 1000))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.timerEnd])

  const startGame = useCallback(() => {
    if (!isHost) return
    const pids = room.players.map(p => p.id)
    const wd = assignWords(pids)
    const cat = Object.values(wd)[0]?.category ?? ''
    const words: Record<string, string> = {}
    const pi: YsState['playerInfo'] = {}
    Object.entries(wd).forEach(([id, d]) => { words[id] = d.word; pi[id] = { solved: false, tries: 0 } })
    const ns: YsState = {
      phase: 'playing', words, category: cat, order: pids, idx: 0,
      turnPhase: 'asking', question: '', votes: {}, voteResult: null, lastGuess: null,
      turns: 0, timerEnd: Date.now() + ASK_SEC * 1000, round: (state?.round ?? 0) + 1, playerInfo: pi,
    }
    bcYs(ns); tick(ASK_SEC)
  }, [isHost, room.players, state?.round, bcYs, tick])

  const advance = useCallback((s: YsState) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (Object.values(s.playerInfo).every(p => p.solved) || s.turns + 1 >= s.order.length * 3) {
      // 점수 정산
      const scores: Record<string, number> = {}
      Object.entries(s.playerInfo).forEach(([id, info]) => { if (info.solved) scores[id] = Math.max(3 - info.tries + 1, 1) })
      onAddScore(scores)
      bcYs({ ...s, phase: 'end' }); return
    }
    let nx = (s.idx + 1) % s.order.length; let tr = 0
    while (tr < s.order.length) { if (!s.playerInfo[s.order[nx]]?.solved) break; nx = (nx + 1) % s.order.length; tr++ }
    bcYs({ ...s, idx: nx, turnPhase: 'asking', question: '', votes: {}, voteResult: null, lastGuess: null, turns: s.turns + 1, timerEnd: Date.now() + ASK_SEC * 1000 })
    tick(ASK_SEC)
  }, [bcYs, tick, onAddScore])

  useEffect(() => {
    if (!isHost || !state || tl !== 0 || state.phase !== 'playing') return
    if (state.turnPhase === 'asking') sendAction('YS_ASK', { q: '(시간초과)' })
    else if (state.turnPhase === 'voting') sendAction('YS_VTO')
    else if (state.turnPhase === 'guess') sendAction('YS_PASS')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl])

  const processAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHost) return
    const s = stateRef.current; if (!s || s.phase !== 'playing') return
    const cid = s.order[s.idx]

    if (type === 'YS_ASK' && s.turnPhase === 'asking' && from === cid) {
      if (timerRef.current) clearInterval(timerRef.current)
      bcYs({ ...s, question: data.q as string, turnPhase: 'voting', votes: {}, voteResult: null, timerEnd: Date.now() + VOTE_SEC * 1000 }); tick(VOTE_SEC); return
    }
    if ((type === 'YS_VOTE' || type === 'YS_VTO') && s.turnPhase === 'voting') {
      const nv = type === 'YS_VOTE' ? { ...s.votes, [from]: data.v as 'yes' | 'no' } : s.votes
      const voters = s.order.filter(id => id !== cid)
      if (voters.every(id => nv[id]) || type === 'YS_VTO') {
        if (timerRef.current) clearInterval(timerRef.current)
        const yes = Object.values(nv).filter(v => v === 'yes').length
        const no = Object.values(nv).filter(v => v === 'no').length
        bcYs({ ...s, votes: nv, turnPhase: 'guess', voteResult: { yes, no }, timerEnd: Date.now() + GUESS_SEC * 1000 }); tick(GUESS_SEC)
      } else { bcYs({ ...s, votes: nv }) }
      return
    }
    if (type === 'YS_GUESS' && s.turnPhase === 'guess' && from === cid) {
      const correct = s.words[from] ?? ''; const guess = (data.g as string).trim()
      const ok = guess.toLowerCase() === correct.toLowerCase() || correct.toLowerCase().includes(guess.toLowerCase())
      const pi = { ...s.playerInfo, [from]: { ...s.playerInfo[from], tries: (s.playerInfo[from]?.tries ?? 0) + 1, solved: ok } }
      const ns = { ...s, lastGuess: { ok, guess, name: room.players.find(p => p.id === from)?.name ?? '' }, playerInfo: pi }
      bcYs(ns); setTimeout(() => advance(ns), 2500); return
    }
    if (type === 'YS_PASS' && s.turnPhase === 'guess' && from === cid) { advance(s); return }
  }, [isHost, bcYs, tick, advance, room.players])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__ysActionHandler = processAction
    return () => { delete (window as any).__ysActionHandler }
  }, [processAction])

  if (!state) return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center justify-center px-5 gap-6">
      <div className="text-3xl font-black text-white">🎭 양세찬 게임</div>
      <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4 text-sm text-white/60 flex flex-col gap-1 w-full max-w-sm">
        <div className="font-bold text-purple-300 mb-1">📖 규칙</div>
        <div>• 각자 다른 단어가 이마에 붙습니다</div>
        <div>• 자기 단어만 볼 수 없어요</div>
        <div>• 예/아니오 질문으로 자기 단어를 추리하세요</div>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3">
        {isHost ? <button className="bg-purple-600 rounded-xl py-4 text-white font-bold text-lg active:scale-95 transition w-full" onClick={startGame}>게임 시작</button>
          : <div className="text-white/30 text-sm text-center">방장이 시작하길 기다리는 중...</div>}
        <button className="text-white/20 text-sm text-center py-2" onClick={onBackLobby}>← 게임 목록으로</button>
        <button className="text-white/20 text-sm text-center py-1" onClick={onLeave}>나가기</button>
      </div>
    </div>
  )

  const cid = state.order[state.idx]
  const isMT = cid === myId
  const cpName = room.players.find(p => p.id === cid)?.name
  const myVote = state.votes[myId]
  const voters = state.order.filter(id => id !== cid)
  const maxTime = state.turnPhase === 'voting' ? VOTE_SEC : state.turnPhase === 'guess' ? GUESS_SEC : ASK_SEC

  if (state.phase === 'playing') return (
    <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4">
      {/* 단어판 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {room.players.map(p => (
          <div key={p.id} className={`rounded-xl px-3 py-2 text-center min-w-[68px] border ${state.playerInfo[p.id]?.solved ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5'}`}>
            <div className="text-[10px] text-white/40 mb-0.5">{p.name}</div>
            <div className={`font-bold ${p.id === myId ? 'text-purple-400 text-xl' : 'text-white text-sm'}`}>{p.id === myId ? '???' : state.words[p.id]}</div>
            {state.playerInfo[p.id]?.solved && <div className="text-[10px] text-green-400">✅</div>}
          </div>
        ))}
      </div>
      <div className="text-center text-purple-300 text-xs">카테고리: <span className="font-bold">{state.category}</span></div>
      <div className="w-full bg-white/10 rounded-full h-1"><div className="h-1 rounded-full bg-purple-500 transition-all" style={{ width: `${Math.max(0, (tl / maxTime) * 100)}%` }} /></div>

      <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-3">
        {state.turnPhase === 'asking' && (
          <>
            <div className="text-white/60 text-sm"><span className="text-white font-bold">{cpName}</span>의 질문 차례 {isMT && '(나)'}</div>
            {isMT ? (
              <div className="flex flex-col gap-2">
                <input className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-sm"
                  placeholder="예/아니오로 답할 수 있는 질문" value={qi}
                  onChange={e => setQi(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && qi.trim()) { sendAction('YS_ASK', { q: qi.trim() }); setQi('') } }}
                  maxLength={40} autoFocus />
                <button className="bg-purple-600 rounded-xl py-3 text-white font-bold active:scale-95 transition disabled:opacity-40"
                  disabled={!qi.trim()} onClick={() => { sendAction('YS_ASK', { q: qi.trim() }); setQi('') }}>
                  질문하기 ({tl}s)
                </button>
              </div>
            ) : <div className="text-white/30 text-sm text-center py-4 animate-pulse">질문 준비 중... ({tl}s)</div>}
          </>
        )}

        {state.turnPhase === 'voting' && (
          <>
            <div className="text-white/60 text-sm"><span className="text-white font-bold">{cpName}</span>: &ldquo;{state.question}&rdquo;</div>
            <div className="text-white/40 text-xs">{state.words[cid ?? '']} 기준으로 답하세요</div>
            {!isMT ? (myVote
              ? <div className="text-center text-purple-300 text-sm py-2">투표 완료 ✓ ({Object.keys(state.votes).length}/{voters.length})</div>
              : <div className="flex gap-3">
                  <button className="flex-1 bg-green-600 rounded-xl py-4 text-white font-bold text-xl active:scale-95 transition" onClick={() => sendAction('YS_VOTE', { v: 'yes' })}>✓ 예</button>
                  <button className="flex-1 bg-red-600 rounded-xl py-4 text-white font-bold text-xl active:scale-95 transition" onClick={() => sendAction('YS_VOTE', { v: 'no' })}>✗ 아니오</button>
                </div>)
              : <div className="text-white/30 text-sm text-center py-4 animate-pulse">투표 중... ({Object.keys(state.votes).length}/{voters.length}) ({tl}s)</div>}
          </>
        )}

        {state.turnPhase === 'guess' && (
          <>
            <div className="text-white/60 text-sm"><span className="text-white font-bold">{cpName}</span>: &ldquo;{state.question}&rdquo;</div>
            {state.voteResult && (
              <div className="flex gap-3 justify-center">
                <div className="bg-green-500/20 border border-green-500/40 rounded-xl px-6 py-3 text-center"><div className="text-2xl font-black text-green-400">{state.voteResult.yes}</div><div className="text-xs text-white/40">예</div></div>
                <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-6 py-3 text-center"><div className="text-2xl font-black text-red-400">{state.voteResult.no}</div><div className="text-xs text-white/40">아니오</div></div>
              </div>
            )}
            {state.lastGuess && (
              <div className={`rounded-xl p-3 text-center ${state.lastGuess.ok ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {state.lastGuess.ok ? `🎉 "${state.lastGuess.guess}" 정답!` : `❌ "${state.lastGuess.guess}" 오답`}
              </div>
            )}
            {!state.lastGuess && isMT && (
              <div className="flex flex-col gap-2">
                <input className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-sm text-center"
                  placeholder="내 단어 맞혀보기" value={gi} onChange={e => setGi(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && gi.trim()) { sendAction('YS_GUESS', { g: gi.trim() }); setGi('') } }}
                  maxLength={20} autoFocus />
                <button className="bg-yellow-500 rounded-xl py-3 text-black font-bold active:scale-95 transition disabled:opacity-40"
                  disabled={!gi.trim()} onClick={() => { sendAction('YS_GUESS', { g: gi.trim() }); setGi('') }}>
                  정답 선언! ({tl}s)
                </button>
                <button className="bg-white/5 border border-white/10 rounded-xl py-2.5 text-white/40 text-sm active:scale-95 transition" onClick={() => sendAction('YS_PASS')}>패스</button>
              </div>
            )}
            {!state.lastGuess && !isMT && <div className="text-white/30 text-sm text-center py-2 animate-pulse">{cpName}이 고민 중...</div>}
          </>
        )}
      </div>

      {/* 점수 */}
      <div className="bg-white/5 rounded-xl p-3">
        <div className="flex flex-wrap gap-2">{room.players.map(p => <div key={p.id} className="flex items-center gap-1 text-sm"><span className="text-white/60">{p.name}</span><span className="text-purple-400 font-bold">{p.score}</span>{state.playerInfo[p.id]?.solved && <span className="text-green-400 text-xs">✅</span>}</div>)}</div>
      </div>
    </div>
  )

  // 종료
  const sorted = [...room.players].sort((a, b) => b.score - a.score)
  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-16 pb-8 gap-5">
      <div className="text-3xl font-black text-white">라운드 {state.round} 종료</div>
      <div className="w-full max-w-sm flex flex-col gap-3">
        {sorted.map((p, i) => (
          <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-white/5'}`}>
            <div className="flex items-center gap-3"><span className="text-white/40 w-5">{i + 1}</span><span className="text-white font-medium">{p.name}</span></div>
            <div className="flex items-center gap-2"><span className="text-white/40 text-xs">{state.words[p.id]}</span><span className="text-purple-400 font-bold text-lg">{p.score}점</span></div>
          </div>
        ))}
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
        {isHost && <button className="bg-purple-600 rounded-xl py-4 text-white font-bold text-lg active:scale-95 transition w-full" onClick={startGame}>한 판 더</button>}
        <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50 active:scale-95 transition w-full" onClick={onBackLobby}>다른 게임 하기</button>
      </div>
    </div>
  )
}
