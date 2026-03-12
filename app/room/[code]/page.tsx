'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { makeClient } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { RoomState, GameType, LiarState, TurtleState, YsState, PersonState, SongState, WordRelayState } from '@/lib/types'
import LiarGame from './LiarGame'
import TurtleGame from './TurtleGame'
import YsGame from './YsGame'
import PersonGame from './PersonGame'
import SongGame from './SongGame'
import PenaltyTab from '../PenaltyTab'
import WordRelayGame from './WordRelayGame'

function initRoom(hostId: string, hostName: string, code: string): RoomState {
  return { roomCode: code, hostId, players: [{ id: hostId, name: hostName, score: 0 }], currentGame: 'none', phase: 'lobby' }
}

const GAME_LIST = [
  { key: 'liar' as GameType,       emoji: '🤥', name: '라이어 게임',  desc: '라이어를 찾아라' },
  { key: 'yangsechan' as GameType, emoji: '🎭', name: '양세찬 게임',  desc: '내 이마의 단어를 맞혀라' },
  { key: 'turtle' as GameType,     emoji: '🐢', name: '바다거북스프', desc: '예/아니오로 수수께끼 추리' },
  { key: 'person' as GameType,     emoji: '🕵️', name: '인물 맞추기',  desc: '단서로 인물을 맞혀라' },
  { key: 'song' as GameType,       emoji: '🎵', name: '노래 맞추기',  desc: '가사/단서로 노래를 맞혀라' },
  { key: 'wordrelay' as GameType,  emoji: '🔤', name: '단어 계주',    desc: '팀원이 한 글자씩 이어가라' },
]

export default function RoomPage() {
  const { code } = useParams() as { code: string }
  const router = useRouter()

  const [myId] = useState(() => {
    if (typeof window === 'undefined') return ''
    let id = sessionStorage.getItem('showst_pid')
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('showst_pid', id) }
    return id
  })

  const [nameInput, setNameInput] = useState('')
  const [hasJoined, setHasJoined] = useState(false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const [liarState, setLiarState] = useState<LiarState | null>(null)
  const [turtleState, setTurtleState] = useState<TurtleState | null>(null)
  const [ysState, setYsState] = useState<YsState | null>(null)
  const [personState, setPersonState] = useState<PersonState | null>(null)
  const [songState, setSongState] = useState<SongState | null>(null)
  const [wordRelayState, setWordRelayState] = useState<WordRelayState | null>(null)
  const [copied, setCopied] = useState(false)
  const [lobbyTab, setLobbyTab] = useState<'game' | 'penalty'>('game')
  const [showLeavePopup, setShowLeavePopup] = useState(false)

  const chRef = useRef<RealtimeChannel | null>(null)
  const isHostRef = useRef(false)
  const roomRef = useRef<RoomState | null>(null)
  const liarRef = useRef<LiarState | null>(null)
  const turtleRef = useRef<TurtleState | null>(null)
  const ysRef = useRef<YsState | null>(null)
  const personRef = useRef<PersonState | null>(null)
  const songRef = useRef<SongState | null>(null)
  const wordRelayRef = useRef<WordRelayState | null>(null)
  const hostDoneRef = useRef(false)
  const sb = useRef(makeClient())

  const bcRoom = useCallback((s: RoomState) => { roomRef.current = s; setRoom(s); chRef.current?.send({ type: 'broadcast', event: 'room', payload: s }) }, [])
  const bcLiar = useCallback((s: LiarState) => { liarRef.current = s; setLiarState(s); chRef.current?.send({ type: 'broadcast', event: 'liar', payload: s }) }, [])
  const bcTurtle = useCallback((s: TurtleState) => { turtleRef.current = s; setTurtleState(s); chRef.current?.send({ type: 'broadcast', event: 'turtle', payload: s }) }, [])
  const bcYs = useCallback((s: YsState) => { ysRef.current = s; setYsState(s); chRef.current?.send({ type: 'broadcast', event: 'ys', payload: s }) }, [])
  const bcPerson = useCallback((s: PersonState) => { personRef.current = s; setPersonState(s); chRef.current?.send({ type: 'broadcast', event: 'person', payload: s }) }, [])
  const bcSong = useCallback((s: SongState) => { songRef.current = s; setSongState(s); chRef.current?.send({ type: 'broadcast', event: 'song', payload: s }) }, [])
  const bcWordRelay = useCallback((s: WordRelayState) => { wordRelayRef.current = s; setWordRelayState(s); chRef.current?.send({ type: 'broadcast', event: 'wordrelay', payload: s }) }, [])

  const clearGameStates = useCallback(() => {
    liarRef.current = null; setLiarState(null)
    turtleRef.current = null; setTurtleState(null)
    ysRef.current = null; setYsState(null)
    personRef.current = null; setPersonState(null)
    songRef.current = null; setSongState(null)
    wordRelayRef.current = null; setWordRelayState(null)
  }, [])

  const sendAll = useCallback(() => {
    if (!isHostRef.current) return
    if (roomRef.current) chRef.current?.send({ type: 'broadcast', event: 'room', payload: roomRef.current })
    if (liarRef.current) chRef.current?.send({ type: 'broadcast', event: 'liar', payload: liarRef.current })
    if (turtleRef.current) chRef.current?.send({ type: 'broadcast', event: 'turtle', payload: turtleRef.current })
    if (ysRef.current) chRef.current?.send({ type: 'broadcast', event: 'ys', payload: ysRef.current })
    if (personRef.current) chRef.current?.send({ type: 'broadcast', event: 'person', payload: personRef.current })
    if (songRef.current) chRef.current?.send({ type: 'broadcast', event: 'song', payload: songRef.current })
    if (wordRelayRef.current) chRef.current?.send({ type: 'broadcast', event: 'wordrelay', payload: wordRelayRef.current })
  }, [])

  const processRoomAction = useCallback((type: string, data: Record<string, unknown>, from: string) => {
    if (!isHostRef.current) return
    const r = roomRef.current; if (!r) return

    if (type === 'JOIN') {
      if (r.players.find(p => p.id === from)) { sendAll(); return }
      bcRoom({ ...r, players: [...r.players, { id: from, name: data.name as string, score: 0 }] }); return
    }
    if (type === 'TRANSFER_HOST') {
      const newHostId = data.newHostId as string
      bcRoom({ ...r, hostId: newHostId })
      return
    }
    if (type === 'LEAVE') {
      const remaining = r.players.filter(p => p.id !== from)
      if (remaining.length === 0) return
      const newHost = remaining[0].id
      const newRoom = { ...r, players: remaining, hostId: from === r.hostId ? newHost : r.hostId }
      if (from === r.hostId) isHostRef.current = (newHost === from)
      bcRoom(newRoom)
      if (remaining.length === 1) { bcRoom({ ...newRoom, currentGame: 'none', phase: 'lobby' }); clearGameStates() }
      return
    }
    if (type === 'SELECT_GAME' && r.phase === 'lobby' && from === r.hostId) {
      bcRoom({ ...r, currentGame: data.game as GameType }); return
    }
    if (type === 'BACK_LOBBY' && from === r.hostId) {
      bcRoom({ ...r, currentGame: 'none', phase: 'lobby' }); clearGameStates(); return
    }
    if (type === 'ADD_SCORE') {
      const scores = data.scores as Record<string, number>
      bcRoom({ ...r, players: r.players.map(p => ({ ...p, score: p.score + (scores[p.id] || 0) })) }); return
    }
  }, [bcRoom, sendAll, clearGameStates])

  useEffect(() => {
    if (!myId) return
    const c = sb.current.channel(`showst:${code}`, { config: { broadcast: { self: true } } })
    chRef.current = c

    c.on('broadcast', { event: 'room' }, ({ payload }) => { roomRef.current = payload; setRoom(payload) })
     .on('broadcast', { event: 'liar' }, ({ payload }) => { liarRef.current = payload; setLiarState(payload) })
     .on('broadcast', { event: 'turtle' }, ({ payload }) => { turtleRef.current = payload; setTurtleState(payload) })
     .on('broadcast', { event: 'ys' }, ({ payload }) => { ysRef.current = payload; setYsState(payload) })
     .on('broadcast', { event: 'person' }, ({ payload }) => { personRef.current = payload; setPersonState(payload) })
     .on('broadcast', { event: 'song' }, ({ payload }) => { songRef.current = payload; setSongState(payload) })
     .on('broadcast', { event: 'wordrelay' }, ({ payload }) => { wordRelayRef.current = payload; setWordRelayState(payload) })
     .on('broadcast', { event: 'action' }, ({ payload }) => {
       processRoomAction(payload.type, payload.data, payload.from)
       const t: string = payload.type
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('LIAR_'))      (window as any).__liarActionHandler?.(payload)
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('TT_'))        (window as any).__turtleActionHandler?.(payload)
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('YS_'))        (window as any).__ysActionHandler?.(payload)
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('PERSON_'))    (window as any).__personActionHandler?.(payload)
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('SONG_'))      (window as any).__songActionHandler?.(payload)
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       if (t.startsWith('RELAY_'))     (window as any).__wordRelayActionHandler?.(payload)
     })
     .on('broadcast', { event: 'req' }, () => { sendAll() })
     .subscribe(status => {
       if (status === 'SUBSCRIBED') {
         c.send({ type: 'broadcast', event: 'req', payload: {} })
         setTimeout(() => { if (!hostDoneRef.current && !roomRef.current) { isHostRef.current = true; hostDoneRef.current = true } }, 1500)
       }
     })
    return () => { sb.current.removeChannel(c) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, myId])

  const sendAction = useCallback((type: string, data: Record<string, unknown> = {}) => {
    chRef.current?.send({ type: 'broadcast', event: 'action', payload: { type, data, from: myId } })
  }, [myId])

  const handleJoin = () => {
    const name = nameInput.trim(); if (!name) return
    setHasJoined(true)
    setTimeout(() => {
      if (roomRef.current) sendAction('JOIN', { name })
      else { isHostRef.current = true; hostDoneRef.current = true; bcRoom(initRoom(myId, name, code)) }
    }, 1800)
  }

  const handleLeave = () => {
    const r = roomRef.current
    // 방장이고 2명 이상이면 위임 팝업
    if (r && r.hostId === myId && r.players.length > 1) {
      setShowLeavePopup(true)
      return
    }
    sendAction('LEAVE')
    router.push('/')
  }

  const handleTransferAndLeave = (newHostId: string) => {
    sendAction('TRANSFER_HOST', { newHostId })
    setTimeout(() => {
      sendAction('LEAVE')
      router.push('/')
    }, 200)
  }

  if (!hasJoined) return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center justify-center px-5 gap-6">
      <div className="text-3xl font-black text-white">Showst</div>
      <div className="text-white/40 text-sm">방 코드: <span className="text-white font-bold tracking-widest">{code}</span></div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <input className="w-full bg-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 outline-none text-center text-lg"
          placeholder="닉네임" value={nameInput} onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()} maxLength={8} autoFocus />
        <button className="w-full bg-purple-600 rounded-xl py-3 text-white font-bold text-lg active:scale-95 transition disabled:opacity-40"
          disabled={!nameInput.trim()} onClick={handleJoin}>입장</button>
        <button className="text-white/30 text-sm py-2 text-center" onClick={() => router.push('/')}>← 홈</button>
      </div>
    </div>
  )

  if (!room) return (
    <div className="min-h-screen bg-[#08080e] flex items-center justify-center">
      <div className="text-white/40 animate-pulse">연결 중...</div>
    </div>
  )

  const isHost = room.hostId === myId
  const commonProps = { myId, room, isHost, sendAction, onBackLobby: () => sendAction('BACK_LOBBY'), onAddScore: (scores: Record<string,number>) => sendAction('ADD_SCORE', { scores }), onLeave: handleLeave, bcRoom }

  if (room.currentGame === 'liar')      return <LiarGame      {...commonProps} state={liarState}      bcLiar={bcLiar} />
  if (room.currentGame === 'turtle')    return <TurtleGame    {...commonProps} state={turtleState}    bcTurtle={bcTurtle} />
  if (room.currentGame === 'yangsechan')return <YsGame        {...commonProps} state={ysState}        bcYs={bcYs} />
  if (room.currentGame === 'person')    return <PersonGame    {...commonProps} state={personState}    bcPerson={bcPerson} />
  if (room.currentGame === 'song')      return <SongGame      {...commonProps} state={songState}      bcSong={bcSong} />
  if (room.currentGame === 'wordrelay') return <WordRelayGame {...commonProps} state={wordRelayState} bcWordRelay={bcWordRelay} />

  // 로비
  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col px-5 pt-10 pb-8 gap-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div className="text-xl font-black text-white">Showst</div>
        <div className="flex gap-2">
          <button className="text-white/30 text-xs bg-white/5 rounded-full px-3 py-1.5 active:scale-95 transition"
            onClick={() => { navigator.clipboard?.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
            {copied ? '복사됨 ✓' : `🔗 ${code}`}
          </button>
          <button className="text-white/30 text-xs bg-white/5 rounded-full px-3 py-1.5 active:scale-95 transition" onClick={handleLeave}>나가기</button>
        </div>
      </div>

      <div className="bg-white/5 rounded-2xl p-4">
        <div className="text-white/40 text-xs mb-3">참가자 {room.players.length}명</div>
        <div className="flex flex-wrap gap-2">
          {room.players.map(p => (
            <div key={p.id} className={`rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${p.id === myId ? 'bg-purple-600/40 border border-purple-500/40' : 'bg-white/5'}`}>
              <span className="text-white font-medium">{p.name}</span>
              {p.id === room.hostId && <span className="text-purple-400 text-xs">방장</span>}
              {p.score > 0 && <span className="text-yellow-400 text-xs font-bold">{p.score}점</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="text-white/40 text-xs">{isHost ? '게임을 선택하세요' : '방장이 게임을 선택 중...'}</div>
      <div className="flex gap-2">
        <button onClick={() => setLobbyTab('game')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${lobbyTab === 'game' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>
          🎮 게임
        </button>
        <button onClick={() => setLobbyTab('penalty')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${lobbyTab === 'penalty' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40'}`}>
          🎲 벌칙
        </button>
      </div>
      {lobbyTab === 'penalty' && <PenaltyTab />}
      {lobbyTab === 'game' && <div className="flex flex-col gap-3">

      {/* 방장 위임 팝업 */}
      {showLeavePopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-5">
          <div className="bg-[#14141f] rounded-2xl p-6 w-full max-w-sm border border-white/10 flex flex-col gap-4">
            <div className="text-white font-bold text-center">방장을 누구에게 넘길까요?</div>
            {room.players.filter(p => p.id !== myId).map(p => (
              <button key={p.id} onClick={() => { setShowLeavePopup(false); handleTransferAndLeave(p.id) }}
                className="bg-white/5 border border-white/10 rounded-xl py-3 text-white font-bold active:scale-95 transition">
                {p.name}
              </button>
            ))}
            <button className="text-white/30 text-sm text-center py-2" onClick={() => setShowLeavePopup(false)}>취소</button>
          </div>
        </div>
      )}
        {GAME_LIST.map(g => (
          <button key={g.key} disabled={!isHost} onClick={() => sendAction('SELECT_GAME', { game: g.key })}
            className={`w-full text-left rounded-2xl px-5 py-4 flex items-center gap-4 border transition active:scale-[0.98] ${isHost ? 'bg-white/5 border-white/10' : 'bg-white/3 border-white/5 opacity-60'}`}>
            <div className="text-3xl">{g.emoji}</div>
            <div className="flex-1"><div className="text-white font-bold">{g.name}</div><div className="text-white/40 text-xs mt-0.5">{g.desc}</div></div>
            {isHost && <div className="text-white/30">→</div>}
          </button>
        ))}
      </div>}
    </div>
  )
}
