import { useState } from 'react'
import { usePlanner } from '../store/plannerStore'

export default function SyncPanel() {
  const { sync } = usePlanner()
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!sync.available) {
    return (
      <section className="rounded-3xl border-2 border-slate-100 bg-white p-5">
        <h3 className="font-display text-xl text-slate-700">📱💻 기기 연동</h3>
        <p className="mt-2 text-sm text-slate-400">
          아직 연동 기능이 설정되지 않았어요. (Firebase 설정이 필요해요)
        </p>
      </section>
    )
  }

  async function handleStart() {
    setBusy(true)
    setMessage(null)
    try {
      await sync.startSync()
    } catch {
      setMessage('연동을 시작하지 못했어요. 인터넷 연결을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    const ok = window.confirm(
      '이 기기의 현재 계획/별 데이터가 입력한 코드 쪽 데이터로 바뀌어요. 계속할까요?',
    )
    if (!ok) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await sync.joinSync(joinCode)
      if (result === 'not_found') {
        setMessage('그 코드를 찾을 수 없어요. 코드를 다시 확인해 주세요.')
      } else {
        setMessage('연결됐어요! 이제 두 기기가 같은 데이터를 공유해요.')
        setJoinCode('')
      }
    } catch {
      setMessage('연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  function handleStop() {
    const ok = window.confirm('이 기기의 연동을 해제할까요? (데이터는 이 기기에 그대로 남아요)')
    if (ok) sync.stopSync()
  }

  return (
    <section className="rounded-3xl border-2 border-slate-100 bg-white p-5">
      <h3 className="font-display text-xl text-slate-700">📱💻 기기 연동</h3>
      <p className="mt-1 text-sm text-slate-400">
        패드와 핸드폰에서 같은 계획/별을 보고 싶다면, 한 기기에서 코드를 만들고 다른 기기에서 그
        코드를 입력하세요.
      </p>

      {sync.code ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-600">
                {sync.status === 'connected' && '🟢 연결됨'}
                {sync.status === 'connecting' && '🟡 연결 중...'}
                {sync.status === 'error' && '🔴 연결 오류'}
              </p>
              <p className="font-display mt-1 text-3xl tracking-widest text-emerald-700">{sync.code}</p>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(sync.code!)}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-600 shadow active:scale-95"
            >
              코드 복사
            </button>
          </div>
          <button
            onClick={handleStop}
            className="mt-3 w-full rounded-2xl border-2 border-rose-200 py-2 text-sm font-bold text-rose-400 active:scale-95"
          >
            연동 해제
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-700">① 이 기기 기준으로 시작하기</p>
            <p className="mt-1 text-xs text-amber-600">
              지금 이 기기에 있는 계획을 그대로 다른 기기와 공유할 코드를 만들어요.
            </p>
            <button
              onClick={handleStart}
              disabled={busy}
              className="font-display mt-3 w-full rounded-2xl bg-amber-400 py-3 text-lg text-white shadow shadow-amber-200 active:scale-95 disabled:opacity-50"
            >
              연동 코드 만들기
            </button>
          </div>

          <div className="rounded-2xl bg-sky-50 p-4">
            <p className="text-sm font-bold text-sky-700">② 다른 기기의 코드로 연결하기</p>
            <p className="mt-1 text-xs text-sky-600">
              다른 기기에서 만든 코드를 입력하면, 이 기기 데이터가 그 코드의 데이터로 바뀌어요.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="예: AB12CD"
                maxLength={6}
                className="flex-1 rounded-2xl border-2 border-sky-200 px-4 py-3 text-center text-lg font-bold tracking-widest focus:border-sky-400 focus:outline-none"
              />
              <button
                onClick={handleJoin}
                disabled={busy}
                className="rounded-2xl bg-sky-500 px-5 font-bold text-white shadow active:scale-95 disabled:opacity-50"
              >
                연결
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className="mt-3 text-center text-sm font-bold text-slate-500">{message}</p>}
    </section>
  )
}
