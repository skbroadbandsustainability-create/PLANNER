import { DomUI } from './dom.ts'
import { TennisGame } from './game.ts'
import { Scene3D } from './scene3d.ts'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement

const scene = new Scene3D(canvas)

function resize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  scene.resize(w, h)
}
window.addEventListener('resize', resize)
resize()

const game = new TennisGame(scene, new DomUI((action) => game.dispatch(action)))

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  game.update(dt)
  game.syncScene(dt)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
