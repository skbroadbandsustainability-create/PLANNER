import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STATE, STORAGE_KEY } from '../types'
import type { AppState, RewardGoal, Task } from '../types'

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; task: Task }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'TOGGLE_TASK'; id: string }
  | { type: 'STAMP_DAY'; date: string; stars: number }
  | { type: 'SET_GOAL'; goal: RewardGoal }
  | { type: 'REDEEM_GOAL' }
  | { type: 'SET_KID_NAME'; name: string }
  | { type: 'IMPORT_STATE'; state: AppState }

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
    case 'TOGGLE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, done: !t.done, doneAt: !t.done ? new Date().toISOString() : undefined }
            : t,
        ),
      }
    case 'STAMP_DAY':
      if (state.stampedDates.includes(action.date)) return state
      return {
        ...state,
        stampedDates: [...state.stampedDates, action.date],
        stars: state.stars + action.stars,
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

export const STARS_PER_DAY = 2

/**
 * 특정 날짜의 과제가 전부 완료되면 자동으로 도장 + 별을 지급하고,
 * 방금 완료했다는 신호(justCompleted)를 잠깐 켜준다.
 */
export function useDayCompletion(date: string) {
  const { state, dispatch } = usePlanner()
  const tasksForDate = useMemo(() => state.tasks.filter((t) => t.date === date), [state.tasks, date])
  const total = tasksForDate.length
  const doneCount = tasksForDate.filter((t) => t.done).length
  const allDone = total > 0 && doneCount === total
  const alreadyStamped = state.stampedDates.includes(date)

  const [justCompleted, setJustCompleted] = useState(false)
  const prevAllDone = useRef(allDone)

  useEffect(() => {
    if (allDone && !alreadyStamped) {
      dispatch({ type: 'STAMP_DAY', date, stars: STARS_PER_DAY })
      setJustCompleted(true)
    }
    prevAllDone.current = allDone
  }, [allDone, alreadyStamped, date, dispatch])

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
