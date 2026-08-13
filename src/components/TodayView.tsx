import { useState } from 'react'
import { usePlanner, useDayCompletion } from '../store/plannerStore'
import { addDays, compareTime, formatKoreanDate, isToday, todayKey } from '../utils/date'
import TaskCard from './TaskCard'
import StampModal from './StampModal'

export default function TodayView() {
  const { state, dispatch } = usePlanner()
  const [date, setDate] = useState(todayKey())
  const { tasksForDate, total, doneCount, allDone, stamped, justCompleted, acknowledge } =
    useDayCompletion(date)

  const sorted = [...tasksForDate].sort((a, b) => compareTime(a.time, b.time))
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      {justCompleted && (
        <StampModal kidName={state.kidName} onClose={acknowledge} />
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => setDate((d) => addDays(d, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow active:scale-90"
          aria-label="이전 날짜"
        >
          ◀
        </button>
        <div className="text-center">
          <p className="font-display text-2xl text-slate-800 sm:text-3xl">{formatKoreanDate(date)}</p>
          {!isToday(date) && (
            <button onClick={() => setDate(todayKey())} className="mt-1 text-sm font-bold text-amber-600 underline">
              오늘로 이동
            </button>
          )}
        </div>
        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow active:scale-90"
          aria-label="다음 날짜"
        >
          ▶
        </button>
      </div>

      {total > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between text-lg font-bold text-slate-600">
            <span>
              오늘 할 일 {doneCount} / {total}
            </span>
            <span className="text-amber-600">{percent}%</span>
          </div>
          <div className="mt-2 h-5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      {allDone && (
        <div className="mt-5 flex items-center gap-3 rounded-3xl border-2 border-rose-200 bg-rose-50 p-4">
          <span className="text-4xl">🏅</span>
          <div>
            <p className="font-display text-xl text-rose-600">참 잘했어요! {stamped ? '도장 완료' : ''}</p>
            <p className="text-sm text-rose-400">이 날의 계획을 모두 끝냈어요.</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {sorted.length === 0 && (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/70 p-10 text-center">
            <p className="text-5xl">🗒️</p>
            <p className="mt-3 text-lg font-bold text-slate-400">
              이 날은 등록된 계획이 없어요.
              <br />
              '계획 관리'에서 할 일을 추가해 보세요!
            </p>
          </div>
        )}
        {sorted.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={(id) => dispatch({ type: 'TOGGLE_TASK', id })} />
        ))}
      </div>
    </div>
  )
}
