import { subjectColor } from '../types'
import type { Task } from '../types'

interface Props {
  task: Task
  onToggle: (id: string) => void
  onEdit?: (task: Task) => void
  showDate?: boolean
}

export default function TaskCard({ task, onToggle, onEdit, showDate }: Props) {
  return (
    <div
      className={`flex items-center gap-3 rounded-3xl border-2 p-4 shadow-sm transition-all sm:gap-4 sm:p-5 ${
        task.done ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white'
      }`}
    >
      <button
        onClick={() => onToggle(task.id)}
        aria-label={task.done ? '완료 취소하기' : '완료로 체크하기'}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 text-3xl transition-all active:scale-90 sm:h-16 sm:w-16 ${
          task.done
            ? 'border-emerald-400 bg-emerald-400 text-white'
            : 'border-slate-300 bg-white text-transparent hover:border-amber-300'
        }`}
      >
        ✓
      </button>

      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => onEdit?.(task)}
        disabled={!onEdit}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg text-slate-500 sm:text-xl">{task.time}</span>
          <span className={`rounded-full border px-3 py-0.5 text-sm font-bold sm:text-base ${subjectColor(task.subject)}`}>
            {task.subject}
          </span>
          {showDate && <span className="text-sm text-slate-400">{task.date}</span>}
        </div>
        <p
          className={`mt-1 truncate text-xl font-bold sm:text-2xl ${
            task.done ? 'text-emerald-600 line-through decoration-4' : 'text-slate-800'
          }`}
        >
          {task.title}
        </p>
        {task.memo && <p className="mt-0.5 truncate text-sm text-slate-400">{task.memo}</p>}
      </button>
    </div>
  )
}
