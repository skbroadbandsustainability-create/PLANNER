const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function weekdayLabel(key: string): string {
  return WEEKDAY_LABELS[parseDateKey(key).getDay()]
}

export function addDays(key: string, amount: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + amount)
  return toDateKey(d)
}

// 해당 날짜가 속한 주의 일요일(주 시작)을 반환
export function startOfWeek(key: string): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() - d.getDay())
  return toDateKey(d)
}

export function weekDates(anyDateInWeek: string): string[] {
  const start = startOfWeek(anyDateInWeek)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatKoreanDate(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayLabel(key)})`
}

export function formatMonthShort(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function isToday(key: string): boolean {
  return key === todayKey()
}

export function compareTime(a: string, b: string): number {
  return a.localeCompare(b)
}
