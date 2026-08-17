// 과목 색상 팔레트에 쓰이는 과목 이름 (자유 입력이지만 자주 쓰는 기본값 제공)
export const DEFAULT_SUBJECTS = ['국어', '수학', '영어', '과학', '독서', '기타'] as const

export const SUBJECT_COLORS: Record<string, string> = {
  국어: 'bg-rose-100 text-rose-700 border-rose-300',
  수학: 'bg-sky-100 text-sky-700 border-sky-300',
  영어: 'bg-violet-100 text-violet-700 border-violet-300',
  과학: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  독서: 'bg-amber-100 text-amber-700 border-amber-300',
  기타: 'bg-slate-100 text-slate-700 border-slate-300',
}

export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] ?? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300'
}

export interface Task {
  id: string
  date: string // YYYY-MM-DD
  time: string // HH:mm
  subject: string
  title: string // 할 일 내용
  memo?: string
  done: boolean
  doneAt?: string // ISO timestamp
}

export interface RewardGoal {
  name: string
  targetStars: number
}

export interface AppState {
  tasks: Task[]
  stars: number
  stampedDates: string[] // 그날의 모든 과제를 완료해서 '참 잘했어요' 도장을 받은 날짜들
  goal: RewardGoal
  redeemedGoals: { name: string; stars: number; date: string }[]
  kidName: string
}

export const STORAGE_KEY = 'kids-planner-v1'

export const DEFAULT_STATE: AppState = {
  tasks: [],
  stars: 0,
  stampedDates: [],
  goal: { name: '아이스크림 파티', targetStars: 20 },
  redeemedGoals: [],
  kidName: '우리 아이',
}
