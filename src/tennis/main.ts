import { CANVAS_H, CANVAS_W } from './constants.ts'
import { TennisGame } from './game.ts'

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
canvas.width = CANVAS_W
canvas.height = CANVAS_H
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2D 캔버스 컨텍스트를 생성할 수 없습니다.')

const game = new TennisGame(ctx)

function resize(): void {
  const wrapper = canvas.parentElement
  if (!wrapper) return
  const availW = wrapper.clientWidth
  const availH = wrapper.clientHeight
  const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H)
  canvas.style.width = `${CANVAS_W * scale}px`
  canvas.style.height = `${CANVAS_H * scale}px`
}

window.addEventListener('resize', resize)
resize()

function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = CANVAS_W / rect.width
  const scaleY = CANVAS_H / rect.height
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

canvas.addEventListener('mousemove', (e) => {
  const { x, y } = toCanvasCoords(e.clientX, e.clientY)
  game.handlePointerMove(x, y)
})

canvas.addEventListener('click', (e) => {
  const { x, y } = toCanvasCoords(e.clientX, e.clientY)
  game.handleClick(x, y)
})

canvas.addEventListener(
  'touchstart',
  (e) => {
    const t = e.touches[0]
    if (!t) return
    const { x, y } = toCanvasCoords(t.clientX, t.clientY)
    game.handlePointerMove(x, y)
    game.handleClick(x, y)
  },
  { passive: true },
)

let last = performance.now()
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  game.update(dt)
  game.render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
