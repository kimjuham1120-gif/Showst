'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const genCode = () => Math.random().toString(36).substring(2, 7).toUpperCase()

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState<'home' | 'join'>('home')

  return (
    <div className="min-h-screen bg-[#08080e] flex flex-col items-center justify-center px-5 gap-8">
      <div className="text-center">
        <div className="text-4xl font-black text-white tracking-tight">Showst</div>
        <div className="text-white/30 text-sm mt-2">폰으로 즐기는 단체 게임</div>
      </div>

      {mode === 'home' && (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            className="w-full bg-purple-600 hover:bg-purple-500 active:scale-95 transition rounded-2xl py-4 text-white font-bold text-lg"
            onClick={() => router.push(`/room/${genCode()}`)}
          >
            방 만들기
          </button>
          <button
            className="w-full bg-white/10 hover:bg-white/15 active:scale-95 transition rounded-2xl py-4 text-white font-bold text-lg"
            onClick={() => setMode('join')}
          >
            방 참가하기
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="w-full max-w-xs flex flex-col gap-3">
          <input
            className="w-full bg-white/10 rounded-2xl px-4 py-4 text-white placeholder-white/30 outline-none text-center text-2xl tracking-[0.4em] uppercase font-bold"
            placeholder="코드 입력"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinCode.length >= 4 && router.push(`/room/${joinCode}`)}
            maxLength={6}
            autoFocus
          />
          <button
            className="w-full bg-purple-600 active:scale-95 transition rounded-2xl py-4 text-white font-bold text-lg disabled:opacity-40"
            disabled={joinCode.length < 4}
            onClick={() => router.push(`/room/${joinCode}`)}
          >
            입장
          </button>
          <button className="text-white/30 text-sm py-2 text-center" onClick={() => setMode('home')}>
            ← 뒤로
          </button>
        </div>
      )}

      <div className="text-white/10 text-xs">Showst · 사회자 없이 즐기는 단체 게임</div>
    </div>
  )
}
