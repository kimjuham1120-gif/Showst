export interface Player { id: string; name: string; score: number }
export type GameType = 'none' | 'liar' | 'turtle' | 'yangsechan' | 'person' | 'song' | 'wordrelay'

export interface RoomState {
  roomCode: string; hostId: string; players: Player[]
  currentGame: GameType; phase: 'lobby' | 'in-game'
}

export type LiarPhase = 'lobby'|'speaking'|'discussion'|'voting'|'liar_guess'|'result'
export interface LiarState {
  phase: LiarPhase; liarId: string; topic: string; word: string
  speakOrder: string[]; speakerIdx: number; votes: Record<string,string>
  eliminatedId: string; liarGuess: string; timerEnd: number; round: number
}

export type TurtlePhase = 'select'|'playing'|'end'
export interface QAEntry {
  id: string; playerId: string; playerName: string
  question: string; answer: 'yes'|'no'|'irrelevant'|'pending'
}
export interface TurtleState {
  phase: TurtlePhase; narratorId: string
  usedProblemIds: string[]
  problemId: string; situation: string
  fullStory: string; keywords: string[]
  hints: [string,string,string]; revealedHints: string[]
  hintVotes: Record<string,boolean>
  qaLog: QAEntry[]
  attempts: { playerName: string; guess: string; correct: boolean }[]
  solved: boolean; solverName: string
  timerEnd: number; round: number
}

export type YsPhase = 'lobby'|'playing'|'end'
export type YsTurnPhase = 'asking'|'voting'|'guess'
export interface YsState {
  phase: YsPhase; words: Record<string,string>; category: string
  order: string[]; idx: number; turnPhase: YsTurnPhase
  question: string; votes: Record<string,'yes'|'no'>
  voteResult: {yes:number;no:number}|null
  lastGuess: {ok:boolean;guess:string;name:string}|null
  turns: number; timerEnd: number; round: number
  playerInfo: Record<string,{solved:boolean;tries:number}>
}

export type PersonPhase = 'setup'|'playing'|'end'
export interface PersonClue { text: string; revealed: boolean }
export interface PersonState {
  phase: PersonPhase; narratorId: string; round: number
  answer: string; clues: PersonClue[]; imageData: string
  revealedCount: number
  attempts: { playerName: string; guess: string; correct: boolean }[]
  solverName: string; solved: boolean
}

export type SongPhase = 'setup'|'playing'|'end'
export interface SongClue { text: string; revealed: boolean }
export interface SongState {
  phase: SongPhase; narratorId: string; round: number
  answer: string; clues: SongClue[]; audioData: string
  revealedCount: number
  attempts: { playerName: string; guess: string; correct: boolean }[]
  solverName: string; solved: boolean
}

export type WordRelayPhase = 'setup'|'playing'|'result'
export type TeamConfig = '2vs2'|'3vs3'|'4vs4'|'3vs3vs3'
export interface WordRelayTeam { id: string; name: string; playerIds: string[]; score: number }
export interface WordRelayState {
  phase: WordRelayPhase; round: number
  teamConfig: TeamConfig; teams: WordRelayTeam[]
  usedIds: string[]
  questionId: string
  question: string           // 전체 공개
  answer: string             // result 단계에서만 공개, 평소 ''
  teamProgress: Record<string, { chars: string[]; done: boolean; failed: boolean }>
  winnerId: string
}
