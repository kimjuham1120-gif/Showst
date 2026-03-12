'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoomState, PersonState, PersonClue } from '@/lib/types'

interface Props {
  myId: string; room: RoomState; state: PersonState | null; isHost: boolean
  bcPerson: (s: PersonState) => void
  sendAction: (type: string, data?: Record<string, unknown>) => void
  onBackLobby: () => void; onAddScore: (scores: Record<string, number>) => void
  onLeave: () => void; bcRoom: (s: RoomState) => void
}

export default function PersonGame({ myId, room, state, isHost, bcPerson, sendAction, onBackLobby, onAddScore, onLeave }: Props) {
  const [answerInput, setAnswerInput] = useState('')
  const [clueInput, setClueInput] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [guessInput, setGuessInput] = useState('')
  const stateRef = useRef<PersonState | null>(null)
  stateRef.current = state

  const isNarrator = state?.narratorId === myId

  const startSetup = useCallback((narratorId: string) => {
    if (!isHost) return
    const ns: PersonState = {
      phase: 'setup', narratorId, round: (state?.round ?? 0) + 1,
      answer: '', clues: [], imageData: '', revealedCount: 0,
      attempts: [], solverName: '', solved: false,
    }
    bcPerson(ns)
  }, [isHost, state?.round, bcPerson])

  const processAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHost) return
    const s = stateRef.current; if (!s) return

    if (type === 'PERSON_START' && from === s.narratorId) {
      bcPerson({ ...s, phase: 'playing', answer: data.answer as string, clues: data.clues as PersonClue[], imageData: data.image as string, revealedCount: 0 }); return
    }
    if (type === 'PERSON_REVEAL' && from === s.narratorId) {
      bcPerson({ ...s, revealedCount: Math.min(s.revealedCount + 1, s.clues.length) }); return
    }
    if (type === 'PERSON_GUESS') {
      const guesser = room.players.find(p => p.id === from); if (!guesser) return
      const guess = (data.g as string).trim()
      const ok = s.answer.toLowerCase().includes(guess.toLowerCase()) || guess.toLowerCase().includes(s.answer.toLowerCase())
      const att = { playerName: guesser.name, guess, correct: ok }
      if (ok) {
        onAddScore({ [from]: 1 })
        bcPerson({ ...s, solved: true, solverName: guesser.name, attempts: [...s.attempts, att], phase: 'end' })
      } else {
        bcPerson({ ...s, attempts: [...s.attempts, att] })
      }
      return
    }
  }, [isHost, bcPerson, room.players, onAddScore])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__personActionHandler = processAction
    return () => { delete (window as any).__personActionHandler }
  }, [processAction])

  // 초기 화면
  if (!state) return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-12 pb-8 gap-5">
      <div className="text-3xl font-black text-white">🕵️ 인물 맞추기</div>
      <div className="bg-purple-900/30 border border-purple-500/20 rounded-2xl p-4 text-sm text-white/60 flex flex-col gap-1 w-full max-w-sm">
        <div className="font-bold text-purple-300 mb-1">📖 규칙</div>
        <div>• 진행자가 인물과 단서를 준비합니다</div>
        <div>• 단서를 하나씩 공개하며 인물을 맞혀요</div>
        <div>• 먼저 맞힌 사람 +1점</div>
      </div>
      {isHost ? (
        <div className="w-full max-w-sm flex flex-col gap-3">
          <div className="text-white/50 text-sm text-center">진행자를 선택하세요</div>
          {room.players.map(p => (
            <button key={p.id} onClick={() => startSetup(p.id)}
              className="bg-white/5 border border-white/10 rounded-xl py-3 text-white font-bold active:scale-95 transition w-full">
              {p.name} {p.id === myId ? '(나)' : ''}
            </button>
          ))}
          <button className="text-white/20 text-sm text-center py-2" onClick={onBackLobby}>← 게임 목록으로</button>
        </div>
      ) : <div className="text-white/30 text-sm">방장이 진행자를 선택 중...</div>}
      <button className="text-white/20 text-sm mt-4" onClick={onLeave}>나가기</button>
    </div>
  )

  // 진행자 문제 설정 화면
  if (state.phase === 'setup' && isNarrator) {
    const clues: PersonClue[] = clueInput.split('\n').filter(Boolean).map(t => ({ text: t.trim(), revealed: false }))
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-10 pb-8 gap-4 max-w-lg mx-auto">
        <div className="text-white font-bold">🕵️ 문제 준비</div>
        <div className="text-white/40 text-xs">진행자 전용 — 다른 플레이어에게 보이지 않습니다</div>

        <div className="flex flex-col gap-2">
          <div className="text-white/60 text-sm">정답 인물</div>
          <input className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-sm"
            placeholder="예: 이순신, 아이유, 손흥민" value={answerInput} onChange={e => setAnswerInput(e.target.value)} maxLength={30} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-white/60 text-sm">단서 (한 줄에 하나씩, 쉬운 것부터)</div>
          <textarea className="bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-sm h-28 resize-none"
            placeholder={"예:\n조선 시대 인물이다\n장군이다\n거북선을 만들었다"} value={clueInput} onChange={e => setClueInput(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-white/60 text-sm">사진 (선택)</div>
          <input type="file" accept="image/*" className="text-white/40 text-xs"
            onChange={e => {
              const file = e.target.files?.[0]; if (!file) return
              const reader = new FileReader()
              reader.onload = () => setImagePreview(reader.result as string)
              reader.readAsDataURL(file)
            }} />
          {imagePreview && <img src={imagePreview} alt="" className="rounded-xl w-32 h-32 object-cover" />}
        </div>

        <button
          className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition disabled:opacity-40 mt-2"
          disabled={!answerInput.trim() || clues.length === 0}
          onClick={() => sendAction('PERSON_START', { answer: answerInput.trim(), clues, image: imagePreview })}>
          문제 시작!
        </button>
      </div>
    )
  }

  if (state.phase === 'setup' && !isNarrator) return (
    <div className="min-h-screen bg-[#08080e] flex items-center justify-center">
      <div className="text-white/40 animate-pulse">진행자가 문제를 준비 중...</div>
    </div>
  )

  // 게임 중
  if (state.phase === 'playing') {
    const revealed = state.clues.slice(0, state.revealedCount)
    return (
      <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-8 pb-8 gap-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold">🕵️ 인물 맞추기</div>
          <button className="text-white/20 text-xs" onClick={onLeave}>나가기</button>
        </div>

        {state.imageData && <img src={state.imageData} alt="" className="rounded-2xl w-full max-h-48 object-cover" />}

        <div className="flex flex-col gap-2">
          {revealed.map((c, i) => (
            <div key={i} className="bg-white/5 rounded-xl px-4 py-3 text-white text-sm">
              <span className="text-purple-400 font-bold text-xs mr-2">단서 {i + 1}</span>{c.text}
            </div>
          ))}
          {state.revealedCount < state.clues.length && (
            <div className="bg-white/3 border border-dashed border-white/10 rounded-xl px-4 py-3 text-white/20 text-sm text-center">
              단서 {state.revealedCount + 1} (미공개)
            </div>
          )}
        </div>

        {state.attempts.filter(a => !a.correct).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {state.attempts.filter(a => !a.correct).map((a, i) => (
              <span key={i} className="text-red-400/60 text-xs bg-red-500/10 rounded-full px-2 py-0.5">❌ {a.playerName}: {a.guess}</span>
            ))}
          </div>
        )}

        {isNarrator ? (
          <div className="flex flex-col gap-2 mt-auto">
            <div className="text-red-300 text-xs text-center bg-red-500/10 rounded-xl py-2">정답: {state.answer}</div>
            {state.revealedCount < state.clues.length && (
              <button className="bg-yellow-600 rounded-xl py-3 text-white font-bold active:scale-95 transition"
                onClick={() => sendAction('PERSON_REVEAL')}>다음 단서 공개 ({state.revealedCount}/{state.clues.length})</button>
            )}
          </div>
        ) : (
          <div className="flex gap-2 mt-auto">
            <input className="flex-1 bg-white/10 rounded-xl px-3 py-3 text-white placeholder-white/30 outline-none text-sm"
              placeholder="인물 이름 입력" value={guessInput} onChange={e => setGuessInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&guessInput.trim()){sendAction('PERSON_GUESS',{g:guessInput.trim()});setGuessInput('')} }}
              maxLength={30} />
            <button className="bg-purple-600 rounded-xl px-4 text-white font-bold active:scale-95 transition disabled:opacity-40"
              disabled={!guessInput.trim()} onClick={() => {sendAction('PERSON_GUESS',{g:guessInput.trim()});setGuessInput('')}}>정답!</button>
          </div>
        )}
      </div>
    )
  }

  // 종료
  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center px-5 pt-16 pb-8 gap-5">
      <div className="text-3xl font-black text-white">{state.solved ? '🎉 정답!' : '문제 종료'}</div>
      {state.solved && <div className="text-purple-300"><span className="text-white font-bold">{state.solverName}</span>이 맞혔습니다!</div>}
      <div className="bg-white/5 rounded-2xl p-4 w-full max-w-sm">
        <div className="text-white/40 text-xs mb-1">정답</div>
        <div className="text-white font-bold text-xl">{state.answer}</div>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2">
        {[...room.players].sort((a,b)=>b.score-a.score).map((p,i)=>(
          <div key={p.id} className={`flex items-center justify-between rounded-xl px-4 py-3 ${i===0?'bg-yellow-500/20 border border-yellow-500/40':'bg-white/5'}`}>
            <span className="text-white">{p.name}</span><span className="text-purple-400 font-bold">{p.score}점</span>
          </div>
        ))}
      </div>
      <div className="w-full max-w-sm flex flex-col gap-2 mt-2">
        {isHost && <button className="bg-purple-600 rounded-xl py-4 text-white font-bold active:scale-95 transition w-full" onClick={() => startSetup(state.narratorId)}>다음 문제</button>}
        {isHost && <button className="bg-white/5 border border-white/10 rounded-xl py-3 text-white/50 active:scale-95 transition w-full" onClick={onBackLobby}>다른 게임 하기</button>}
        <button className="text-white/20 text-sm text-center py-2" onClick={onLeave}>나가기</button>
      </div>
    </div>
  )
}
