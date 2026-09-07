import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STATE, STORAGE_KEY } from '../types'
import type { AppState, RewardGoal, Task } from '../types'
import { isFirebaseConfigured } from '../firebaseConfig'
import { fetchState, generateSyncCode, pushState, subscribeState } from '../sync'

const SYNC_CODE_KEY = 'kids-planner-sync-code'
export type SyncStatus = 'off' | 'connecting' | 'connected' | 'error'

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
  sync: {
    available: boolean
    code: string | null
    status: SyncStatus
    error: string | null
    startSync: () => Promise<string>
    joinSync: (code: string) => Promise<'joined' | 'not_found'>
    stopSync: () => void
  }
}

const PlannerContext = createContext<PlannerContextValue | null>(null)

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)
  const [syncCode, setSyncCode] = useState<string | null>(() => localStorage.getItem(SYNC_CODE_KEY))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off')
  const [syncError, setSyncError] = useState<string | null>(null)

  // "이미 알고 있는 것보다 새 내용인지"를 기기 간에 그대로 비교 가능한 시각(ms)
  // 기준으로 판단한다. (기기마다 따로 세는 번호를 쓰면, 로컬 조작을 더 많이 한
  // 기기의 번호가 실제로는 더 오래된 다른 기기의 최신 내용보다 커져버려서
  // 그 기기의 변경을 "오래된 것"으로 착각하고 무시해버리는 문제가 있었다.)
  const knownUpdatedAtRef = useRef(0)
  // 원격에서 막 받아온 상태를 로컬 reducer에 반영하면 아래 "상태가 바뀔 때마다
  // 저장" 효과도 같이 실행되는데, 그때 방금 받은 걸 다시 그대로 쏘아 보내면 안
  // 되므로 "이 상태 객체는 방금 원격에서 가져온 것"이라는 표시를 남겨둔다.
  // (단순 boolean 플래그 대신 상태 객체 자체를 비교하면, 짧은 시간에 원격
  // 갱신이 연달아 와도 각각 정확히 스스로를 구분해서 건너뛸 수 있다.)
  const lastImportedStateRef = useRef<AppState | null>(null)
  const unsubscribeRef = useRef<null | (() => void)>(null)
  // 저장 요청을 순서대로 하나씩만 보내기 위한 큐. 짧은 시간에 여러 번 바뀌면
  // (예: 할 일을 연달아 추가) 저장 요청들이 네트워크에서 순서가 뒤바뀌어 먼저
  // 보낸 게 나중에 도착해서 최신 내용을 덮어써버릴 수 있어, 반드시 이전 저장이
  // 끝난 뒤에 다음 저장을 보내도록 체인으로 묶는다.
  const pushChainRef = useRef<Promise<void>>(Promise.resolve())
  // 새로고침 직후 맨 처음 렌더링은 "이 기기에 저장돼 있던(어쩌면 오래된) 내용"일
  // 뿐, 사용자가 방금 한 행동이 아니다. 이걸 최신 시각을 달아 그대로 서버에
  // 밀어넣으면, 아직 서버에서 최신 내용을 받아오기도 전에 이 기기의 오래된
  // 내용이 "방금 한 일"인 것처럼 덮어써버릴 수 있어, 맨 처음 한 번은 절대
  // 밀어넣지 않는다 (서버의 최신 내용을 받아온 뒤부터만 진짜 로컬 변경으로 간주).
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // 로컬에서 상태가 바뀔 때마다(할 일 체크, 계획 추가 등) 연동 중이면 클라우드에도 반영
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }
    if (lastImportedStateRef.current === state) {
      lastImportedStateRef.current = null
      return
    }
    if (!syncCode) return
    const code = syncCode
    const snapshot = state
    const ts = Date.now()
    knownUpdatedAtRef.current = ts
    pushChainRef.current = pushChainRef.current
      .catch(() => {})
      .then(() => pushState(code, snapshot, ts))
      .catch(() => setSyncError('저장에 실패했어요. 인터넷 연결을 확인해 주세요.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const connect = useCallback((code: string) => {
    unsubscribeRef.current?.()
    setSyncStatus('connecting')
    setSyncError(null)

    // 연결이 응답 없이 계속 "연결 중"에 머무르지 않도록, 일정 시간 안에
    // 첫 응답이 없으면 네트워크 문제로 안내한다.
    const timeoutId = setTimeout(() => {
      setSyncStatus('error')
      setSyncError('연동 서버에 연결하지 못했어요. 와이파이/데이터 연결을 확인해 주세요.')
    }, 15000)

    unsubscribeRef.current = subscribeState(
      code,
      (data) => {
        clearTimeout(timeoutId)
        setSyncStatus('connected')
        if (data.updatedAtMs > knownUpdatedAtRef.current) {
          knownUpdatedAtRef.current = data.updatedAtMs
          lastImportedStateRef.current = data.state
          dispatch({ type: 'IMPORT_STATE', state: data.state })
        }
      },
      () => {
        clearTimeout(timeoutId)
        setSyncStatus('error')
        setSyncError('연동 서버에 연결하지 못했어요.')
      },
    )
  }, [])

  useEffect(() => {
    if (syncCode) connect(syncCode)
    return () => unsubscribeRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startSync = useCallback(async () => {
    const code = generateSyncCode()
    const ts = Date.now()
    knownUpdatedAtRef.current = ts
    await pushState(code, state, ts)
    localStorage.setItem(SYNC_CODE_KEY, code)
    setSyncCode(code)
    connect(code)
    return code
  }, [state, connect])

  const joinSync = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toUpperCase()
      const remote = await fetchState(trimmed)
      if (!remote) return 'not_found' as const
      knownUpdatedAtRef.current = remote.updatedAtMs
      lastImportedStateRef.current = remote.state
      dispatch({ type: 'IMPORT_STATE', state: remote.state })
      localStorage.setItem(SYNC_CODE_KEY, trimmed)
      setSyncCode(trimmed)
      connect(trimmed)
      return 'joined' as const
    },
    [connect],
  )

  const stopSync = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    localStorage.removeItem(SYNC_CODE_KEY)
    setSyncCode(null)
    setSyncStatus('off')
    setSyncError(null)
  }, [])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      sync: {
        available: isFirebaseConfigured,
        code: syncCode,
        status: syncCode ? syncStatus : 'off' as SyncStatus,
        error: syncError,
        startSync,
        joinSync,
        stopSync,
      },
    }),
    [state, syncCode, syncStatus, syncError, startSync, joinSync, stopSync],
  )

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
