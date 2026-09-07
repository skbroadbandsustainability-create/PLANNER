import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'
import type { AppState } from './types'

// firebase SDK는 용량이 커서, 연동 기능을 실제로 쓰기 전까지는 불러오지 않는다
// (동기화를 안 쓰는 대부분의 사용자는 이 코드를 다운로드하지 않아도 됨).
let dbInstance: unknown = null

async function loadFirestore() {
  const [{ initializeApp, getApps, getApp }, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
  ])
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  if (!dbInstance) {
    // 일부 공유기/통신망/브라우저 보안 설정에서는 Firestore의 기본 스트리밍 연결이
    // 응답 없이 계속 대기하는 경우가 있어, 더 호환성 좋은 롱폴링 방식으로 자동 전환한다.
    dbInstance = firestore.initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  }
  return { db: dbInstance as ReturnType<typeof firestore.getFirestore>, firestore }
}

// 네트워크가 막혀있으면 요청이 응답 없이 무한정 대기할 수 있어서,
// 일정 시간이 지나면 명확한 에러로 실패 처리한다.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

export interface SyncDoc {
  state: AppState
  // 기기마다 따로 세는 번호(rev) 대신, 기기 간에 그대로 비교 가능한
  // 시각(ms)을 기준으로 "어느 쪽이 더 최신인지" 판단한다.
  updatedAtMs: number
}

// 헷갈리기 쉬운 0/O, 1/I는 빼고 6자리 코드를 만든다.
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const TIMEOUT_MS = 15000
const TIMEOUT_MESSAGE = '서버에 연결하지 못했어요. 네트워크(와이파이/데이터)를 확인해 주세요.'

export async function pushState(code: string, state: AppState, updatedAtMs: number): Promise<void> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 아직 설정되지 않았어요')
  const { db, firestore } = await loadFirestore()
  await withTimeout(
    firestore.setDoc(firestore.doc(db, 'plannerSync', code), {
      state,
      updatedAtMs,
      updatedAt: firestore.serverTimestamp(),
    }),
    TIMEOUT_MS,
    TIMEOUT_MESSAGE,
  )
}

export async function fetchState(code: string): Promise<SyncDoc | null> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 아직 설정되지 않았어요')
  const { db, firestore } = await loadFirestore()
  const snap = await withTimeout(
    firestore.getDoc(firestore.doc(db, 'plannerSync', code)),
    TIMEOUT_MS,
    TIMEOUT_MESSAGE,
  )
  if (!snap.exists()) return null
  return snap.data() as SyncDoc
}

// onSnapshot 구독은 비동기로 시작되므로, 즉시 쓸 수 있는 "구독 취소" 함수를 반환한다.
export function subscribeState(
  code: string,
  onChange: (data: SyncDoc) => void,
  onError: (err: Error) => void,
): () => void {
  let unsub: (() => void) | null = null
  let cancelled = false

  loadFirestore()
    .then(({ db, firestore }) => {
      if (cancelled) return
      unsub = firestore.onSnapshot(
        firestore.doc(db, 'plannerSync', code),
        (snap: import('firebase/firestore').DocumentSnapshot) => {
          if (snap.exists()) onChange(snap.data() as SyncDoc)
        },
        (err: Error) => onError(err),
      )
    })
    .catch((err) => onError(err as Error))

  return () => {
    cancelled = true
    unsub?.()
  }
}
