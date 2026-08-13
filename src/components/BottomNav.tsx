export type ViewKey = 'today' | 'week' | 'rewards' | 'manage'

const ITEMS: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'today', label: '오늘', icon: '☀️' },
  { key: 'week', label: '이번 주', icon: '🗓️' },
  { key: 'rewards', label: '보상', icon: '🏆' },
  { key: 'manage', label: '계획 관리', icon: '✏️' },
]

interface Props {
  active: ViewKey
  onChange: (key: ViewKey) => void
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="sticky bottom-0 z-30 border-t-2 border-amber-100 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`no-select flex flex-col items-center gap-1 py-3 text-sm font-bold transition-colors sm:text-base ${
              active === item.key ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            <span className={`text-2xl transition-transform ${active === item.key ? 'scale-110' : ''}`}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
