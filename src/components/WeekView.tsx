import { useMemo, useState } from 'react'
import { usePlanner } from '../store/plannerStore'
import { addDays, compareTime, formatMonthShort, todayKey, weekDates, weekdayLabel } from '../utils/date'
import { subjectColor } from '../types'
import TaskCard from './TaskCard'

export default function WeekView() {
  const { state, dispatch } = usePlanner()
  const [anchor, setAnchor] = useState(todayKey())
  const [openDate, setOpenDate] = useState<string | null>(todayKey())

  const dates = useMemo(() => weekDates(anchor), [anchor])

  const byDate = useMemo(() => {
    return dates.map((date) => {
      const tasks = state.tasks.filter((t) => t.date === date).sort((a, b) => compareTime(a.time, b.time))
      const done = tasks.filter((t) => t.done).length
      return { date, tasks, done, total: tasks.length, stamped: state.stampedDates.includes(date) }
    })
  }, [dates, state.tasks, state.stampedDates])

  const weekTotal = byDate.reduce((acc, d) => acc + d.total, 0)
  const weekDone = byDate.reduce((acc, d) => acc + d.done, 0)
  const weekIncomplete = weekTotal - weekDone
  const rate = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100)

  const incompleteTasks = byDate.flatMap((d) => d.tasks.filter((t) => !t.done))

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setAnchor((d) => addDays(d, -7))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow active:scale-90"
          aria-label="지난 주"
        >
          ◀
        </button>
        <p className="font-display text-xl text-slate-800 sm:text-2xl">
          {formatMonthShort(dates[0])} ~ {formatMonthShort(dates[6])}
        </p>
        <button
          onClick={() => setAnchor((d) => addDays(d, 7))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow active:scale-90"
          aria-label="다음 주"
        >
          ▶
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatCard label="완료" value={weekDone} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="미완료" value={weekIncomplete} color="text-rose-500" bg="bg-rose-50" />
        <StatCard label="완료율" value={`${rate}%`} color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {byDate.map((d) => (
          <div key={d.date} className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-white">
            <button
              onClick={() => setOpenDate((cur) => (cur === d.date ? null : d.date))}
              className="flex w-full items-center gap-3 p-4"
            >
              <div
                className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl font-display text-sm ${
                  d.date === todayKey() ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span>{weekdayLabel(d.date)}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-slate-700">{formatMonthShort(d.date)}</p>
                <p className="text-sm text-slate-400">
                  {d.total === 0 ? '계획 없음' : `${d.done} / ${d.total} 완료`}
                </p>
              </div>
              {d.stamped && <span className="text-2xl">🏅</span>}
              {d.total > 0 && (
                <div className="hidden w-24 sm:block">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-400"
                      style={{ width: `${d.total === 0 ? 0 : (d.done / d.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              <span className="text-slate-300">{openDate === d.date ? '▲' : '▼'}</span>
            </button>
            {openDate === d.date && d.tasks.length > 0 && (
              <div className="flex flex-col gap-2 border-t-2 border-slate-50 p-3">
                {d.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggle={(id) => dispatch({ type: 'TOGGLE_TASK', id })} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="font-display text-xl text-slate-700">😅 아직 못한 과제 ({incompleteTasks.length})</h3>
        {incompleteTasks.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 p-4 text-center font-bold text-emerald-600">
            이번 주 할 일을 모두 끝냈어요! 최고예요 🎉
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {incompleteTasks.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-3"
              >
                <span className="text-sm font-bold text-rose-400">{formatMonthShort(t.date)}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${subjectColor(t.subject)}`}>
                  {t.subject}
                </span>
                <span className="flex-1 truncate font-bold text-slate-600">{t.title}</span>
                <span className="text-sm text-slate-400">{t.time}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className={`rounded-3xl ${bg} p-4 text-center`}>
      <p className={`font-display text-3xl ${color}`}>{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{label}</p>
    </div>
  )
}
