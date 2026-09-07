import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_STATE, STORAGE_KEY } from '../types'
import type { AppState, RewardGoal, Task } from '../types'
import { isFirebaseConfigured } from '../firebaseConfig'
import { fetchState, generateSyncCode, pushState } from '../sync'

const SYNC_CODE_KEY = 'kids-planner-sync-code'
// 이 기기가 마지막으로 서버와 맞춰봤던(직접 저장했거나 받아온) 시각(ms).
// 새로고침해도 사라지면 안 되므로 localStorage에 같이 저장해둔다 — 그래야
// "방금 이 기기에서 한 저장이 새로고침 때문에 서버까지 도착하기 전에
// 끊겼는지"를 다시 켰을 때도 정확히 판단할 수 있다.
const SYNC_KNOWN_TS_KEY = 'kids-planner-sync-known-ts'
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

// 계속 연결을 붙잡고 있는 실시간 구독 대신, 이 주기마다 한 번씩 서버에 최신
// 내용이 있는지 물어본다(+ 화면을 다시 볼 때/포커스될 때도 별도로 물어봄).
const SYNC_POLL_MS = 4000

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

function loadInitialKnownTs(): number {
  try {
    const raw = localStorage.getItem(SYNC_KNOWN_TS_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

function persistKnownTs(ts: number) {
  try {
    localStorage.setItem(SYNC_KNOWN_TS_KEY, String(ts))
  } catch {
    // 저장 실패해도 이번 세션에서는 메모리상 값으로 계속 동작함
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
      // 체크 해제할 때 doneAt에 undefined를 넣으면(값 자체는 지워지지만 필드는
      // 남아있는 상태) 클라우드에 저장할 때 오류가 나서 저장이 조용히
      // 실패한다(Firestore는 undefined 값을 가진 필드를 허용하지 않음).
      // 그래서 그냥 값을 비우는 대신 필드 자체를 아예 없애버린다.
      const tasks = state.tasks.map((t) => {
        if (t.id !== action.id) return t
        if (t.done) {
          const { doneAt: _doneAt, ...rest } = t
          return { ...rest, done: false }
        }
        return { ...t, done: true, doneAt: new Date().toISOString() }
      })

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
  // 새로고침해도 없어지면 안 되므로 localStorage에 저장해둔 값으로 시작한다.
  const knownUpdatedAtRef = useRef(loadInitialKnownTs())
  // 원격에서 막 받아온 상태를 로컬 reducer에 반영하면 아래 "상태가 바뀔 때마다
  // 저장" 효과도 같이 실행되는데, 그때 방금 받은 걸 다시 그대로 쏘아 보내면 안
  // 되므로 "이 상태 객체는 방금 원격에서 가져온 것"이라는 표시를 남겨둔다.
  // (단순 boolean 플래그 대신 상태 객체 자체를 비교하면, 짧은 시간에 원격
  // 갱신이 연달아 와도 각각 정확히 스스로를 구분해서 건너뛸 수 있다.)
  const lastImportedStateRef = useRef<AppState | null>(null)
  // 지금 연동 중인 코드에 대해 주기적으로 서버를 확인 중인 타이머(setInterval id).
  const pollTimerRef = useRef<number | null>(null)
  // 저장 요청을 순서대로 하나씩만 보내기 위한 큐. 짧은 시간에 여러 번 바뀌면
  // (예: 할 일을 연달아 추가) 저장 요청들이 네트워크에서 순서가 뒤바뀌어 먼저
  // 보낸 게 나중에 도착해서 최신 내용을 덮어써버릴 수 있어, 반드시 이전 저장이
  // 끝난 뒤에 다음 저장을 보내도록 체인으로 묶는다.
  const pushChainRef = useRef<Promise<void>>(Promise.resolve())
  // 연결할 때마다 한 번, 서버와 이 기기 중 뭐가 최신인지 먼저 확인(reconcile)을
  // 끝내기 전까지는 "상태가 바뀔 때마다 저장" 효과가 끼어들면 안 된다. (아직
  // 서버 쪽 최신 내용을 모르는 채로 지금 화면 내용을 그대로 밀어넣어버릴 수
  // 있으므로) 확인이 끝난 뒤에만 true가 된다. (ref가 아니라 state인 이유:
  // 값이 바뀔 때 저장 효과가 다시 한번 실행돼서, 확인하는 동안 있었던
  // 변경사항도 놓치지 않고 저장하도록 하기 위함)
  const [syncReady, setSyncReady] = useState(false)
  // pullOnce/reconcile 같은 비동기 함수 안에서 "지금 이 순간의 최신 state"를
  // 참조하기 위한 값. (의존성 배열에 state를 넣으면 상태가 바뀔 때마다
  // 연결이 다시 만들어져야 해서, 대신 항상 최신값을 담아두는 ref를 쓴다)
  const latestStateRef = useRef(state)
  latestStateRef.current = state

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // 로컬에서 상태가 바뀔 때마다(할 일 체크, 계획 추가 등) 연동 중이면 클라우드에도 반영
  useEffect(() => {
    if (!syncCode) return
    if (!syncReady) return
    if (lastImportedStateRef.current === state) {
      lastImportedStateRef.current = null
      return
    }
    const code = syncCode
    const snapshot = state
    const ts = Date.now()
    knownUpdatedAtRef.current = ts
    persistKnownTs(ts)
    pushChainRef.current = pushChainRef.current
      .catch(() => {})
      .then(() => pushState(code, snapshot, ts))
      .catch(() => setSyncError('저장에 실패했어요. 인터넷 연결을 확인해 주세요.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, syncReady])

  // 서버에 한 번 물어봐서, 이 기기가 알고 있는 것보다 새 내용이 있으면 받아온다.
  const pullOnce = useCallback(async (code: string) => {
    try {
      const remote = await fetchState(code)
      setSyncStatus('connected')
      setSyncError(null)
      if (remote && remote.updatedAtMs > knownUpdatedAtRef.current) {
        knownUpdatedAtRef.current = remote.updatedAtMs
        persistKnownTs(remote.updatedAtMs)
        lastImportedStateRef.current = remote.state
        dispatch({ type: 'IMPORT_STATE', state: remote.state })
      }
    } catch {
      setSyncStatus('error')
      setSyncError('연동 서버에 연결하지 못했어요. 와이파이/데이터 연결을 확인해 주세요.')
    }
  }, [])

  // 연결을 새로 맺을 때(앱을 열었을 때 등) 딱 한 번, 서버와 이 기기 중 어느
  // 쪽이 최신인지 확인한다. 서버가 더 최신이면 받아오고, 반대로 이 기기가 더
  // 최신인데 서버가 못 따라온 상태라면(예: 저장 도중 새로고침 때문에 방금 한
  // 저장이 서버까지 도착하지 못하고 끊겼을 경우) 지금 내용을 다시 저장해서
  // 끊겼던 저장을 이어서 마무리한다.
  const reconcileOnConnect = useCallback(async (code: string) => {
    try {
      const remote = await fetchState(code)
      if (remote && remote.updatedAtMs > knownUpdatedAtRef.current) {
        knownUpdatedAtRef.current = remote.updatedAtMs
        persistKnownTs(remote.updatedAtMs)
        lastImportedStateRef.current = remote.state
        dispatch({ type: 'IMPORT_STATE', state: remote.state })
      } else if (!remote || remote.updatedAtMs < knownUpdatedAtRef.current) {
        const ts = knownUpdatedAtRef.current || Date.now()
        knownUpdatedAtRef.current = ts
        persistKnownTs(ts)
        await pushState(code, latestStateRef.current, ts)
      }
      setSyncStatus('connected')
      setSyncError(null)
    } catch {
      setSyncStatus('error')
      setSyncError('연동 서버에 연결하지 못했어요. 와이파이/데이터 연결을 확인해 주세요.')
    }
  }, [])

  const connect = useCallback(
    (code: string) => {
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
      setSyncStatus('connecting')
      setSyncError(null)
      setSyncReady(false)
      void reconcileOnConnect(code).finally(() => {
        setSyncReady(true)
      })
      pollTimerRef.current = window.setInterval(() => void pullOnce(code), SYNC_POLL_MS)
    },
    [reconcileOnConnect, pullOnce],
  )

  useEffect(() => {
    if (syncCode) connect(syncCode)
    return () => {
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 앱을 다시 열거나(홈 화면 아이콘 등) 다른 탭에서 돌아왔을 때는, 다음 주기적
  // 확인까지 기다리지 않고 바로 한 번 확인해서 최신 내용을 빨리 보여준다.
  useEffect(() => {
    if (!syncCode) return
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'hidden') return
      void pullOnce(syncCode)
    }
    document.addEventListener('visibilitychange', onFocusOrVisible)
    window.addEventListener('focus', onFocusOrVisible)
    return () => {
      document.removeEventListener('visibilitychange', onFocusOrVisible)
      window.removeEventListener('focus', onFocusOrVisible)
    }
  }, [syncCode, pullOnce])

  const startSync = useCallback(async () => {
    const code = generateSyncCode()
    const ts = Date.now()
    knownUpdatedAtRef.current = ts
    persistKnownTs(ts)
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
      persistKnownTs(remote.updatedAtMs)
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
    if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
    setSyncReady(false)
    knownUpdatedAtRef.current = 0
    localStorage.removeItem(SYNC_CODE_KEY)
    localStorage.removeItem(SYNC_KNOWN_TS_KEY)
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
