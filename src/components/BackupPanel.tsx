import { useState } from 'react'
import { usePlanner } from '../store/plannerStore'
import type { AppState } from '../types'

function encodeState(state: AppState): string {
  const json = JSON.stringify(state)
  return btoa(unescape(encodeURIComponent(json)))
}

function decodeState(code: string): AppState {
  const json = decodeURIComponent(escape(atob(code.trim())))
  return JSON.parse(json) as AppState
}

export default function BackupPanel() {
  const { state, dispatch } = usePlanner()
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const exportCode = encodeState(state)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(exportCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMessage('복사에 실패했어요. 아래 글상자를 길게 눌러 직접 전체 선택 후 복사해 주세요.')
    }
  }

  function handleImport() {
    if (!importText.trim()) return
    const ok = window.confirm('이 기기의 현재 계획/별 데이터가 붙여넣은 백업 데이터로 바뀌어요. 계속할까요?')
    if (!ok) return
    try {
      const imported = decodeState(importText)
      if (!imported || !Array.isArray(imported.tasks)) throw new Error('invalid')
      dispatch({ type: 'IMPORT_STATE', state: imported })
      setMessage('가져오기 성공! 데이터가 복원됐어요.')
      setImportText('')
    } catch {
      setMessage('가져오기에 실패했어요. 백업 코드를 다시 확인해 주세요.')
    }
  }

  return (
    <section className="rounded-3xl border-2 border-slate-100 bg-white p-5">
      <h3 className="font-display text-xl text-slate-700">💾 백업 코드로 데이터 옮기기</h3>
      <p className="mt-1 text-sm text-slate-400">
        인터넷 연동이 안 되는 화면(예: 공유 링크)에서는, 아래 코드를 복사해서 다른 기기/주소에
        붙여넣는 방식으로 데이터를 옮길 수 있어요.
      </p>

      <div className="mt-4 rounded-2xl bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-700">① 이 화면의 데이터 내보내기</p>
        <textarea
          readOnly
          value={exportCode}
          onFocus={(e) => e.target.select()}
          rows={4}
          className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white p-3 font-mono text-xs text-slate-500"
        />
        <button
          onClick={handleCopy}
          className="font-display mt-2 w-full rounded-2xl bg-amber-400 py-3 text-lg text-white shadow shadow-amber-200 active:scale-95"
        >
          {copied ? '복사됨! ✓' : '백업 코드 복사하기'}
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-sky-50 p-4">
        <p className="text-sm font-bold text-sky-700">② 다른 화면에서 복사한 코드 붙여넣기</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="여기에 백업 코드를 붙여넣으세요"
          rows={4}
          className="mt-2 w-full rounded-xl border-2 border-sky-200 bg-white p-3 font-mono text-xs focus:border-sky-400 focus:outline-none"
        />
        <button
          onClick={handleImport}
          className="font-display mt-2 w-full rounded-2xl bg-sky-500 py-3 text-lg text-white shadow active:scale-95"
        >
          이 코드로 가져오기
        </button>
      </div>

      {message && <p className="mt-3 text-center text-sm font-bold text-slate-500">{message}</p>}
    </section>
  )
}
