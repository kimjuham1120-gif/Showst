export interface WordRelayQuestion {
  id: string
  question: string
  answer: string
  category: string
}

export const CATEGORIES = ['전체', '세계상식', '한국사', '대중문화', '스포츠', '과학'] as const
export type Category = typeof CATEGORIES[number]

export const QUESTIONS: WordRelayQuestion[] = [
  // 세계상식
  { id: 'w1',  question: '세계에서 가장 큰 성벽은?',              answer: '만리장성',  category: '세계상식' },
  { id: 'w2',  question: '세계에서 가장 높은 산은?',              answer: '에베레스트', category: '세계상식' },
  { id: 'w3',  question: '세계에서 가장 넓은 나라는?',            answer: '러시아',    category: '세계상식' },
  { id: 'w4',  question: '프랑스의 수도는?',                      answer: '파리',      category: '세계상식' },
  { id: 'w5',  question: '세계에서 가장 긴 강은?',                answer: '나일강',    category: '세계상식' },
  { id: 'w6',  question: '미국의 초대 대통령은?',                 answer: '워싱턴',    category: '세계상식' },
  { id: 'w7',  question: '올림픽이 처음 열린 나라는?',            answer: '그리스',    category: '세계상식' },

  // 한국사
  { id: 'k1',  question: '한글을 만든 조선의 왕은?',              answer: '세종대왕',  category: '한국사' },
  { id: 'k2',  question: '거북선을 만든 장군은?',                 answer: '이순신',    category: '한국사' },
  { id: 'k3',  question: '우리나라 최초의 국가는?',               answer: '고조선',    category: '한국사' },
  { id: 'k4',  question: '조선의 수도는?',                        answer: '한양',      category: '한국사' },
  { id: 'k5',  question: '삼국 시대의 세 나라가 아닌 것은? (고구려, 백제, 신라, 가야 중)',  answer: '가야',  category: '한국사' },
  { id: 'k6',  question: '고려를 세운 왕은?',                     answer: '왕건',      category: '한국사' },

  // 대중문화
  { id: 'c1',  question: '방탄소년단의 영어 약자는?',             answer: 'BTS',       category: '대중문화' },
  { id: 'c2',  question: '아이유의 본명은?',                      answer: '이지은',    category: '대중문화' },
  { id: 'c3',  question: '기생충을 감독한 한국 감독은?',          answer: '봉준호',    category: '대중문화' },
  { id: 'c4',  question: '오징어게임이 방영된 OTT는?',            answer: '넷플릭스',  category: '대중문화' },
  { id: 'c5',  question: '뽀로로의 직업은?',                      answer: '파일럿',    category: '대중문화' },
  { id: 'c6',  question: '마블의 아이언맨 본명은?',               answer: '토니스타크', category: '대중문화' },

  // 스포츠
  { id: 's1',  question: '월드컵이 열리는 주기는? (단위: 년)',    answer: '사년',      category: '스포츠' },
  { id: 's2',  question: '축구에서 골키퍼를 제외한 선수 수는? (한 팀)',  answer: '열명', category: '스포츠' },
  { id: 's3',  question: '한국 축구의 레전드, 등번호 13번은?',    answer: '박지성',    category: '스포츠' },
  { id: 's4',  question: '야구에서 3개의 스트라이크는?',          answer: '삼진아웃',  category: '스포츠' },
  { id: 's5',  question: '수영 배영에서 선수가 보는 방향은?',     answer: '위',        category: '스포츠' },

  // 과학
  { id: 'sc1', question: '물의 화학식은?',                        answer: 'H2O',       category: '과학' },
  { id: 'sc2', question: '빛의 속도는 약 몇 만 km/s?',           answer: '삼십만',    category: '과학' },
  { id: 'sc3', question: '지구에서 가장 가까운 별은?',            answer: '태양',      category: '과학' },
  { id: 'sc4', question: '인체에서 가장 큰 장기는?',              answer: '피부',      category: '과학' },
  { id: 'sc5', question: '사과가 떨어지는 것을 보고 만유인력을 발견한 과학자는?', answer: '뉴턴', category: '과학' },
]

export function pickQuestion(usedIds: string[], category: Category): WordRelayQuestion | null {
  const pool = QUESTIONS.filter(q =>
    !usedIds.includes(q.id) &&
    (category === '전체' || q.category === category)
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
