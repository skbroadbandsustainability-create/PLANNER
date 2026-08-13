import { useMemo } from 'react'
import { usePlanner } from '../store/plannerStore'
import { addDays, todayKey, weekdayLabel } from '../utils/date'

export default function RewardsView() {
  const { state, dispatch } = usePlanner()
  const { stars, goal, stampedDates, redeemedGoals } = state

  const canRedeem = stars >= goal.targetStars
  const percent = Math.min(100, Math.round((stars / Math.max(1, goal.targetStars)) * 100))

  // 최근 28일 스탬프 달력
  const last28 = useMemo(() => {
    const start = addDays(todayKey(), -27)
    return Array.from({ length: 28 }, (_, i) => addDays(start, i))
  }, [])

  const streak = useMemo(() => {
    let count = 0
    let cursor = todayKey()
    while (stampedDates.includes(cursor)) {
      count += 1
      cursor = addDays(cursor, -1)
    }
    return count
  }, [stampedDates])

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-amber-300 via-amber-200 to-rose-200 p-6 text-center shadow-lg">
        <p className="font-display text-lg text-amber-900/70">모은 별</p>
        <p className="font-display text-6xl text-amber-900 drop-shadow-sm">⭐ {stars}</p>
        {streak > 0 && (
          <p className="mt-2 inline-block rounded-full bg-white/60 px-4 py-1 text-sm font-bold text-amber-800">
            🔥 {streak}일 연속 완주 중!
          </p>
        )}
      </div>

      <div className="mt-6 rounded-3xl border-2 border-slate-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-slate-700">🎁 다음 목표</h3>
          <span className="text-sm font-bold text-slate-400">
            {stars} / {goal.targetStars}개
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold text-rose-500">{goal.name}</p>
        <div className="mt-3 h-5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-300 to-amber-400 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <button
          disabled={!canRedeem}
          onClick={() => dispatch({ type: 'REDEEM_GOAL' })}
          className={`font-display mt-4 w-full rounded-2xl py-3 text-xl text-white shadow transition-transform active:scale-95 ${
            canRedeem ? 'bg-rose-400 shadow-rose-200' : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
          }`}
        >
          {canRedeem ? '보상 받기 🎉' : `별 ${goal.targetStars - stars}개 더 모으면 받을 수 있어요`}
        </button>
      </div>

      <div className="mt-6 rounded-3xl border-2 border-slate-100 bg-white p-5">
        <h3 className="font-display text-xl text-slate-700">🏅 최근 도장 기록</h3>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {last28.map((date) => {
            const got = stampedDates.includes(date)
            const isToday = date === todayKey()
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-300">{weekdayLabel(date)}</span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${
                    got
                      ? 'bg-amber-300'
                      : isToday
                        ? 'border-2 border-dashed border-amber-300 bg-white'
                        : 'bg-slate-50'
                  }`}
                  title={date}
                >
                  {got ? '🏅' : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {redeemedGoals.length > 0 && (
        <div className="mt-6 rounded-3xl border-2 border-slate-100 bg-white p-5">
          <h3 className="font-display text-xl text-slate-700">🎉 받았던 보상들</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {[...redeemedGoals].reverse().map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2">
                <span className="font-bold text-slate-600">{r.name}</span>
                <span className="text-sm text-slate-400">{new Date(r.date).toLocaleDateString('ko-KR')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
