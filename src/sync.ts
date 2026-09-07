import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'
import type { AppState } from './types'

// firebase SDK는 용량이 커서, 연동 기능을 실제로 쓰기 전까지는 불러오지 않는다
// (동기화를 안 쓰는 대부분의 사용자는 이 코드를 다운로드하지 않아도 됨).
//
// "실시간 구독(onSnapshot)" 방식은 계속 연결을 붙잡고 있는 스트리밍 연결이라
// 일부 공유기/통신망/브라우저 환경에서 응답 없이 무한정 걸려있는 문제가 있었다.
// 대신 "필요할 때마다 한 번씩 물어보는(REST 방식)" 가벼운 firestore/lite를 쓰고,
// 화면(plannerStore.tsx) 쪽에서 주기적으로 + 화면을 다시 볼 때마다 물어보는
// 방식으로 바꿔서, 매번 짧게 끝나는 요청만 있고 응답 없이 계속 걸려있는 연결
// 자체가 없도록 한다. (아이 영어단어 앱에서 이미 잘 동작하던 것과 같은 방식)
let dbInstance: unknown = null

async function loadFirestore() {
  const [{ initializeApp, getApps, getApp }, firestoreLite] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore/lite'),
  ])
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  if (!dbInstance) {
    dbInstance = firestoreLite.getFirestore(app)
  }
  return { db: dbInstance as ReturnType<typeof firestoreLite.getFirestore>, firestore: firestoreLite }
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

const TIMEOUT_MS = 10000
const TIMEOUT_MESSAGE = '서버에 연결하지 못했어요. 네트워크(와이파이/데이터)를 확인해 주세요.'

export async function pushState(code: string, state: AppState, updatedAtMs: number): Promise<void> {
  if (!isFirebaseConfigured) throw new Error('Firebase가 아직 설정되지 않았어요')
  const { db, firestore } = await loadFirestore()
  await withTimeout(
    firestore.setDoc(firestore.doc(db, 'plannerSync', code), { state, updatedAtMs }),
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
