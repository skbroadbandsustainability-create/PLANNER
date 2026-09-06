import { useMemo, useState } from 'react'
import { usePlanner } from '../store/plannerStore'
import { formatKoreanDate, parseDateKey, todayKey, toDateKey } from '../utils/date'
import { DEFAULT_SUBJECTS, subjectColor } from '../types'
import type { Task } from '../types'
import SyncPanel from './SyncPanel'
import BackupPanel from './BackupPanel'

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

function emptyForm(date: string) {
  return {
    date,
    time: '16:00',
    subject: DEFAULT_SUBJECTS[0] as string,
    title: '',
    memo: '',
  }
}

export default function ManageView() {
  const { state, dispatch } = usePlanner()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm(todayKey()))
  const [repeatOn, setRepeatOn] = useState(false)
  const [repeatDays, setRepeatDays] = useState<number[]>([])
  const [repeatWeeks, setRepeatWeeks] = useState(4)
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')

  const grouped = useMemo(() => {
    const list = [...state.tasks].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    const filtered = list.filter((t) => (filter === 'upcoming' ? t.date >= todayKey() : t.date < todayKey()))
    const map = new Map<string, Task[]>()
    for (const t of filtered) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date)!.push(t)
    }
    return Array.from(map.entries())
  }, [state.tasks, filter])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm(todayKey()))
    setRepeatOn(false)
    setRepeatDays([])
    setRepeatWeeks(4)
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setForm({ date: task.date, time: task.time, subject: task.subject, title: task.title, memo: task.memo ?? '' })
    setRepeatOn(false)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    if (editingId) {
      dispatch({
        type: 'UPDATE_TASK',
        task: { id: editingId, ...form, title: form.title.trim(), done: state.tasks.find((t) => t.id === editingId)?.done ?? false },
      })
      resetForm()
      return
    }

    if (repeatOn && repeatDays.length > 0) {
      const start = parseDateKey(form.date)
      const totalDays = repeatWeeks * 7
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        if (repeatDays.includes(d.getDay())) {
          dispatch({
            type: 'ADD_TASK',
            task: { id: crypto.randomUUID(), ...form, date: toDateKey(d), title: form.title.trim(), done: false },
          })
        }
      }
    } else {
      dispatch({ type: 'ADD_TASK', task: { id: crypto.randomUUID(), ...form, title: form.title.trim(), done: false } })
    }
    resetForm()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <section className="rounded-3xl border-2 border-slate-100 bg-white p-5">
        <h3 className="font-display text-xl text-slate-700">👦 아이 이름</h3>
        <input
          value={state.kidName}
          onChange={(e) => dispatch({ type: 'SET_KID_NAME', name: e.target.value })}
          className="mt-3 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg font-bold focus:border-amber-300 focus:outline-none"
          placeholder="아이 이름을 입력하세요"
        />
      </section>

      <div className="mt-5">
        <SyncPanel />
      </div>

      <div className="mt-5">
        <BackupPanel />
      </div>

      <section className="mt-5 rounded-3xl border-2 border-slate-100 bg-white p-5">
        <h3 className="font-display text-xl text-slate-700">🎁 보상 목표 설정</h3>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={state.goal.name}
            onChange={(e) => dispatch({ type: 'SET_GOAL', goal: { ...state.goal, name: e.target.value } })}
            className="flex-1 rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-amber-300 focus:outline-none"
            placeholder="예: 아이스크림 파티"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={state.goal.targetStars}
              onChange={(e) =>
                dispatch({ type: 'SET_GOAL', goal: { ...state.goal, targetStars: Number(e.target.value) || 1 } })
              }
              className="w-24 rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-amber-300 focus:outline-none"
            />
            <span className="font-bold text-slate-500">개 별</span>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-400">매일 계획을 모두 끝내면 별 2개를 받아요.</p>
      </section>

      <section className="mt-5 rounded-3xl border-2 border-slate-100 bg-white p-5">
        <h3 className="font-display text-xl text-slate-700">⭐ 별 개수 수정</h3>
        <p className="mt-1 text-sm text-slate-400">실수로 체크해서 별이 잘못 쌓였을 때 여기서 바로 고칠 수 있어요.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[-5, -1].map((delta) => (
            <button
              key={delta}
              onClick={() => dispatch({ type: 'SET_STARS', stars: state.stars + delta })}
              className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 active:scale-95"
            >
              {delta}
            </button>
          ))}
          <input
            type="number"
            min={0}
            value={state.stars}
            onChange={(e) => dispatch({ type: 'SET_STARS', stars: Number(e.target.value) || 0 })}
            className="w-24 rounded-2xl border-2 border-amber-200 bg-amber-50 px-3 py-2 text-center text-xl font-bold text-amber-700 focus:border-amber-400 focus:outline-none"
          />
          {[1, 5].map((delta) => (
            <button
              key={delta}
              onClick={() => dispatch({ type: 'SET_STARS', stars: state.stars + delta })}
              className="rounded-full border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 active:scale-95"
            >
              +{delta}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-3xl border-2 border-amber-100 bg-amber-50/40 p-5">
        <h3 className="font-display text-xl text-slate-700">{editingId ? '✏️ 계획 수정' : '➕ 새 계획 추가'}</h3>
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-bold text-slate-500">
              날짜
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-2xl border-2 border-slate-200 px-3 py-3 text-base focus:border-amber-300 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold text-slate-500">
              시간
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="rounded-2xl border-2 border-slate-200 px-3 py-3 text-base focus:border-amber-300 focus:outline-none"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-bold text-slate-500">
            과목
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SUBJECTS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, subject: s }))}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                    form.subject === s ? subjectColor(s) : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
              <input
                value={DEFAULT_SUBJECTS.includes(form.subject as (typeof DEFAULT_SUBJECTS)[number]) ? '' : form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="직접 입력"
                className="w-28 rounded-full border-2 border-dashed border-slate-200 px-3 py-2 text-sm focus:border-amber-300 focus:outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-slate-500">
            할 일
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="예: 수학 문제집 3쪽 풀기"
              className="rounded-2xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-amber-300 focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-slate-500">
            메모 (선택)
            <input
              value={form.memo}
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
              placeholder="예: 틀린 문제 다시 풀기"
              className="rounded-2xl border-2 border-slate-200 px-4 py-3 focus:border-amber-300 focus:outline-none"
            />
          </label>

          {!editingId && (
            <div className="rounded-2xl bg-white p-4">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <input type="checkbox" checked={repeatOn} onChange={(e) => setRepeatOn(e.target.checked)} className="h-5 w-5" />
                여러 날 반복해서 추가하기
              </label>
              {repeatOn && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_NAMES.map((name, idx) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() =>
                          setRepeatDays((cur) => (cur.includes(idx) ? cur.filter((d) => d !== idx) : [...cur, idx]))
                        }
                        className={`h-10 w-10 rounded-full border-2 text-sm font-bold ${
                          repeatDays.includes(idx)
                            ? 'border-amber-400 bg-amber-400 text-white'
                            : 'border-slate-200 text-slate-400'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-500">
                    반복 기간
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={repeatWeeks}
                      onChange={(e) => setRepeatWeeks(Number(e.target.value) || 1)}
                      className="w-16 rounded-xl border-2 border-slate-200 px-2 py-1"
                    />
                    주
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 rounded-2xl border-2 border-slate-200 py-3 font-bold text-slate-500"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="font-display flex-1 rounded-2xl bg-amber-400 py-3 text-xl text-white shadow shadow-amber-200 active:scale-95"
            >
              {editingId ? '수정 완료' : '추가하기'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('upcoming')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === 'upcoming' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}
          >
            예정된 계획
          </button>
          <button
            onClick={() => setFilter('past')}
            className={`rounded-full px-4 py-2 text-sm font-bold ${filter === 'past' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}
          >
            지난 계획
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {grouped.length === 0 && (
            <p className="rounded-2xl bg-slate-50 p-6 text-center font-bold text-slate-400">등록된 계획이 없어요.</p>
          )}
          {grouped.map(([date, tasks]) => (
            <div key={date}>
              <p className="font-display text-slate-500">{formatKoreanDate(date)}</p>
              <div className="mt-2 flex flex-col gap-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-2xl border-2 border-slate-100 bg-white p-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${subjectColor(task.subject)}`}>
                      {task.subject}
                    </span>
                    <span className="text-sm text-slate-400">{task.time}</span>
                    <span className={`flex-1 truncate font-bold ${task.done ? 'text-emerald-500 line-through' : 'text-slate-700'}`}>
                      {task.title}
                    </span>
                    <button onClick={() => startEdit(task)} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">
                      수정
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'DELETE_TASK', id: task.id })}
                      className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-400"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-slate-300">모든 계획은 이 기기(패드)에 안전하게 저장돼요.</p>
    </div>
  )
}
