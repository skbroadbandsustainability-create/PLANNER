import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'
import type { AppState } from './types'

// firebase SDK는 용량이 커서, 연동 기능을 실제로 쓰기 전까지는 불러오지 않는다
// (동기화를 안 쓰는 대부분의 사용자는 이 코드를 다운로드하지 않아도 됨).
async function loadFirestore() {
  const [{ initializeApp, getApps, getApp }, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
  ])
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  const db = firestore.getFirestore(app)
  return { db, firestore }
}

export interface SyncDoc {
  state: AppState
  rev: number
}

// 헷갈리기 쉬운 0/O, 1/I는 빼고 6자리 코드를 만든다.
export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function pushState(code: string, state: AppState, rev: number): Promise<void> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 아직 설정되지 않았어요')
  const { db, firestore } = await loadFirestore()
  await firestore.setDoc(firestore.doc(db, 'plannerSync', code), {
    state,
    rev,
    updatedAt: firestore.serverTimestamp(),
  })
}

export async function fetchState(code: string): Promise<SyncDoc | null> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 아직 설정되지 않았어요')
  const { db, firestore } = await loadFirestore()
  const snap = await firestore.getDoc(firestore.doc(db, 'plannerSync', code))
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
