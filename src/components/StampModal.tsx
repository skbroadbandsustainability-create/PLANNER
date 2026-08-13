import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { STARS_PER_DAY } from '../store/plannerStore'

interface Props {
  kidName: string
  onClose: () => void
}

export default function StampModal({ kidName, onClose }: Props) {
  useEffect(() => {
    const duration = 1500
    const end = Date.now() + duration
    const colors = ['#f59e0b', '#ec4899', '#38bdf8', '#34d399']
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors })
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop-in flex w-full max-w-sm flex-col items-center rounded-[2.5rem] border-8 border-amber-300 bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="animate-stamp flex h-40 w-40 items-center justify-center rounded-full border-8 border-rose-500 text-rose-500">
          <div className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl">참 잘했어요</span>
            <span className="mt-1 text-4xl">⭐</span>
          </div>
        </div>
        <h2 className="font-display mt-6 text-3xl text-amber-600">오늘의 미션 성공!</h2>
        <p className="mt-2 text-lg text-slate-500">
          {kidName}, 오늘 할 일을 모두 끝냈어요! 정말 대단해요 🎉
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-amber-100 px-5 py-2 text-xl font-bold text-amber-700">
          ⭐ 별 {STARS_PER_DAY}개 획득!
        </div>
        <button
          onClick={onClose}
          className="font-display mt-6 w-full rounded-2xl bg-amber-400 py-4 text-2xl text-white shadow-lg shadow-amber-200 transition-transform active:scale-95"
        >
          신난다!
        </button>
      </div>
    </div>
  )
}
