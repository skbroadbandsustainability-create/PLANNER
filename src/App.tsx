import { useState } from 'react'
import BottomNav from './components/BottomNav'
import type { ViewKey } from './components/BottomNav'
import TodayView from './components/TodayView'
import WeekView from './components/WeekView'
import RewardsView from './components/RewardsView'
import ManageView from './components/ManageView'
import { usePlanner } from './store/plannerStore'

function App() {
  const [view, setView] = useState<ViewKey>('today')
  const { state } = usePlanner()

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-sky-50 via-amber-50/40 to-white">
      <header className="sticky top-0 z-20 border-b-2 border-amber-100 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="font-display text-2xl text-slate-800 sm:text-3xl">
              📚 {state.kidName}의 공부 계획표
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-amber-100 px-4 py-2 font-bold text-amber-700">
            ⭐ {state.stars}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view === 'today' && <TodayView />}
        {view === 'week' && <WeekView />}
        {view === 'rewards' && <RewardsView />}
        {view === 'manage' && <ManageView />}
      </main>

      <BottomNav active={view} onChange={setView} />
    </div>
  )
}

export default App
