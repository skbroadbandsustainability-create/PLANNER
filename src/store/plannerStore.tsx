import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STATE, STORAGE_KEY } from '../types'
import type { AppState, RewardGoal, Task } from '../types'

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'SET_GOAL'; goal: RewardGoal }
  | { type: 'REDEEM_GOAL' }
  | { type: 'SET_KID_NAME'; name: string }
  | { type: 'SET_STARS'; stars: number }
  | { type: 'IMPORT_STATE'; state: AppState }

export const STARS_PER_DAY = 2

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return DEFAULT_STATE
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)) }
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }
    case 'TOGGLE_TASK': {
      const target = state.tasks.find((t) => t.id === action.id)
      if (!target) return state
      const tasks = state.tasks.map((t) =>
        t.id === action.id
          ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined }
          : t,
      )

      // 이 날짜의 과제가 전부 끝났는지 다시 계산해서, 도장/별을 자동으로 주거나 취소한다.
      // (실수로 체크했다가 취소하면 도장과 별도 함께 취소돼야 하므로)
      const tasksForDate = tasks.filter((t) => t.date === target.date)
      const allDoneNow = tasksForDate.length > 0 && tasksForDate.every((t) => t.done)
      const wasStamped = state.stampedDates.includes(target.date)

      if (allDoneNow && !wasStamped) {
        return {
          ...state,
          tasks,
          stampedDates: [...state.stampedDates, target.date],
          stars: state.stars + STARS_PER_DAY,
        }
      }
      if (!allDoneNow && wasStamped) {
        return {
          ...state,
          tasks,
          stampedDates: state.stampedDates.filter((d) => d !== target.date),
          stars: Math.max(0, state.stars - STARS_PER_DAY),
        }
      }
      return { ...state, tasks }
    }
    case 'SET_GOAL':
      return { ...state, goal: action.goal }
    case 'REDEEM_GOAL':
      if (state.stars < state.goal.targetStars) return state
      return {
        ...state,
        stars: state.stars - state.goal.targetStars,
        redeemedGoals: [
          ...state.redeemedGoals,
          { name: state.goal.name, stars: state.goal.targetStars, date: new Date().toISOString() },
        ],
      }
    case 'SET_KID_NAME':
      return { ...state, kidName: action.name }
    case 'SET_STARS':
      return { ...state, stars: Math.max(0, Math.round(action.stars)) }
    case 'IMPORT_STATE':
      return action.state
    default:
      return state
  }
}

interface PlannerContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const ctx = useContext(PlannerContext)
  if (!ctx) throw new Error('usePlanner는 PlannerProvider 안에서 사용해야 해요')
  return ctx
}

/**
 * 특정 날짜의 완료 상태를 계산하고, 방금 그 날의 과제를 모두 끝낸 순간(justCompleted)을 알려준다.
 * 도장/별 지급·취소는 reducer(TOGGLE_TASK)가 처리하므로, 여기서는 축하 모달을 띄울 타이밍만 감지한다.
 */
export function useDayCompletion(date: string) {
  const { state } = usePlanner()
  const tasksForDate = useMemo(() => state.tasks.filter((t) => t.date === date), [state.tasks, date])
  const total = tasksForDate.length
  const doneCount = tasksForDate.filter((t) => t.done).length
  const allDone = total > 0 && doneCount === total

  const [justCompleted, setJustCompleted] = useState(false)
  const prevAllDone = useRef(allDone)

  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setJustCompleted(true)
    }
    prevAllDone.current = allDone
  }, [allDone])

  return {
    tasksForDate,
    total,
    doneCount,
    allDone,
    stamped: state.stampedDates.includes(date),
    justCompleted,
    acknowledge: () => setJustCompleted(false),
  }
}
