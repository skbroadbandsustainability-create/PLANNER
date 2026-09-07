import type { Ball, Character } from './entities.ts'
import {
  CANVAS_H,
  CANVAS_W,
  COURT_BOTTOM,
  COURT_LEFT,
  COURT_RIGHT,
  COURT_TOP,
  NET_Y,
  WALL_LEFT,
  WALL_RIGHT,
} from './constants.ts'

export function drawCourt(ctx: CanvasRenderingContext2D, t: number): void {
  // 배경 하늘/관중석 느낌의 그라디언트
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
  sky.addColorStop(0, '#8fd1ff')
  sky.addColorStop(0.35, '#bfe9ff')
  sky.addColorStop(0.36, '#2f8f4e')
  sky.addColorStop(1, '#1f6e3c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 투명한 벽(코트 좌우) - 은은하게 반짝이는 에너지 필드로 표현
  const wallW = COURT_LEFT - WALL_LEFT
  drawWall(ctx, WALL_LEFT, WALL_LEFT + wallW, t)
  drawWall(ctx, WALL_RIGHT - wallW, WALL_RIGHT, t)

  // 코트 바닥(하드코트 느낌)
  const courtGrad = ctx.createLinearGradient(0, COURT_TOP, 0, COURT_BOTTOM)
  courtGrad.addColorStop(0, '#3f7fd9')
  courtGrad.addColorStop(1, '#2f5fb0')
  ctx.fillStyle = courtGrad
  ctx.fillRect(COURT_LEFT, COURT_TOP, COURT_RIGHT - COURT_LEFT, COURT_BOTTOM - COURT_TOP)

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3
  ctx.strokeRect(COURT_LEFT, COURT_TOP, COURT_RIGHT - COURT_LEFT, COURT_BOTTOM - COURT_TOP)

  // 중앙선(세로)
  ctx.beginPath()
  ctx.moveTo((COURT_LEFT + COURT_RIGHT) / 2, COURT_TOP)
  ctx.lineTo((COURT_LEFT + COURT_RIGHT) / 2, COURT_BOTTOM)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 2
  ctx.stroke()

  // 네트
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(COURT_LEFT - 6, NET_Y)
  ctx.lineTo(COURT_RIGHT + 6, NET_Y)
  ctx.stroke()
  ctx.setLineDash([6, 6])
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(30,30,40,0.5)'
  ctx.beginPath()
  ctx.moveTo(COURT_LEFT - 6, NET_Y)
  ctx.lineTo(COURT_RIGHT + 6, NET_Y)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#e8e8e8'
  ctx.fillRect(COURT_LEFT - 10, NET_Y - 4, 6, 8)
  ctx.fillRect(COURT_RIGHT + 4, NET_Y - 4, 6, 8)
  ctx.restore()
}

function drawWall(ctx: CanvasRenderingContext2D, x1: number, x2: number, t: number): void {
  ctx.save()
  const shimmer = 0.08 + Math.sin(t * 2.4) * 0.03
  ctx.fillStyle = `rgba(150,220,255,${shimmer})`
  ctx.fillRect(x1, COURT_TOP - 20, x2 - x1, COURT_BOTTOM - COURT_TOP + 40)
  ctx.strokeStyle = 'rgba(220,250,255,0.5)'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    const lx = x1 + ((x2 - x1) / 4) * i + ((t * 30) % (x2 - x1))
    const wrapped = x1 + (((lx - x1) % (x2 - x1)) + (x2 - x1)) % (x2 - x1)
    ctx.beginPath()
    ctx.moveTo(wrapped, COURT_TOP - 20)
    ctx.lineTo(wrapped, COURT_BOTTOM + 20)
    ctx.stroke()
  }
  ctx.restore()
}

function statusEmoji(kind: string): string {
  if (kind === 'root') return '🌿'
  if (kind === 'burn') return '🔥'
  if (kind === 'confuse') return '💫'
  return ''
}

export function drawCharacter(ctx: CanvasRenderingContext2D, c: Character): void {
  ctx.save()
  ctx.translate(c.x, c.y)

  // 그림자
  ctx.beginPath()
  ctx.ellipse(0, c.def.radius * 0.9, c.def.radius * 1.1, c.def.radius * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fill()

  const squash = 1 - Math.min(0.28, c.swingAnim * 1.6)
  const stretch = 1 + Math.min(0.28, c.swingAnim * 1.6)
  ctx.scale(stretch, squash)

  if (c.isMega) {
    ctx.save()
    ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 140) * 0.15
    ctx.beginPath()
    ctx.arc(0, 0, c.def.radius * 1.7, 0, Math.PI * 2)
    ctx.fillStyle = c.def.megaColor
    ctx.fill()
    ctx.restore()
  }

  const bodyColor = c.isMega ? c.def.megaColor : c.def.color
  const isStunned = c.isStunned()

  ctx.globalAlpha = isStunned ? 0.55 : 1
  if (c.hitFlash > 0) {
    ctx.filter = 'brightness(1.7) saturate(1.4)'
  }

  // 몸통
  ctx.beginPath()
  ctx.ellipse(0, 4, c.def.radius, c.def.radius * 1.05, 0, 0, Math.PI * 2)
  ctx.fillStyle = bodyColor
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.stroke()

  // 머리
  ctx.beginPath()
  ctx.arc(0, -c.def.radius * 0.75, c.def.radius * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = bodyColor
  ctx.fill()
  ctx.stroke()

  // 종족별 특징
  drawSpeciesFeatures(ctx, c)

  // 눈
  ctx.fillStyle = '#1c1c1c'
  const eyeY = -c.def.radius * 0.78
  ctx.beginPath()
  ctx.arc(-5 * c.facing, eyeY, 3.4, 0, Math.PI * 2)
  ctx.arc(5 * c.facing, eyeY, 3.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.filter = 'none'
  ctx.globalAlpha = 1

  // 라켓
  ctx.save()
  const swing = Math.sin(Math.min(1, c.swingAnim * 6) * Math.PI) * (c.swingAnim > 0 ? 1 : 0)
  ctx.translate(c.def.radius * 0.9 * c.facing, 2)
  ctx.rotate(c.facing * (0.5 - swing * 1.3))
  ctx.strokeStyle = '#5b4636'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 16)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, -6, 8, 11, 0, 0, Math.PI * 2)
  ctx.strokeStyle = '#e8e2d0'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()

  ctx.restore()

  // 상태 이상 아이콘
  if (c.statusEffects.length > 0) {
    ctx.save()
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    c.statusEffects.forEach((e, i) => {
      ctx.fillText(
        statusEmoji(e.kind),
        c.x + (i - (c.statusEffects.length - 1) / 2) * 18,
        c.y - c.def.radius * 1.9,
      )
    })
    ctx.restore()
  }

  if (isStunned) {
    ctx.save()
    ctx.font = 'bold 13px "Jua", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff176'
    const spin = performance.now() / 200
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3
      ctx.fillText('★', c.x + Math.cos(a) * 20, c.y - c.def.radius * 1.9 + Math.sin(a) * 6)
    }
    ctx.restore()
  }
}

function drawSpeciesFeatures(ctx: CanvasRenderingContext2D, c: Character): void {
  const r = c.def.radius
  ctx.fillStyle = c.def.accentColor
  if (c.def.id === 'greninja') {
    // 혀 스카프
    ctx.beginPath()
    ctx.moveTo(0, -r * 0.2)
    ctx.quadraticCurveTo(r * 1.1 * c.facing, r * 0.6, r * 0.5 * c.facing, r * 1.5)
    ctx.lineWidth = 5
    ctx.strokeStyle = c.def.accentColor
    ctx.stroke()
    // 귀/돌기
    ctx.beginPath()
    ctx.moveTo(-r * 0.55, -r * 1.2)
    ctx.lineTo(-r * 0.15, -r * 1.55)
    ctx.lineTo(-r * 0.05, -r * 1.05)
    ctx.closePath()
    ctx.moveTo(r * 0.55, -r * 1.2)
    ctx.lineTo(r * 0.15, -r * 1.55)
    ctx.lineTo(r * 0.05, -r * 1.05)
    ctx.closePath()
    ctx.fillStyle = c.isMega ? c.def.megaColor : c.def.color
    ctx.fill()
  } else if (c.def.id === 'rillaboom') {
    // 드럼
    ctx.beginPath()
    ctx.ellipse(0, r * 1.15, r * 0.75, r * 0.4, 0, 0, Math.PI * 2)
    ctx.fillStyle = c.def.accentColor
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
    // 갈기
    ctx.beginPath()
    ctx.arc(0, -r * 0.75, r * 0.95, Math.PI * 0.15, Math.PI * 0.85)
    ctx.strokeStyle = '#2f4a1c'
    ctx.lineWidth = 6
    ctx.stroke()
  } else if (c.def.id === 'delphox') {
    // 지팡이(막대)
    ctx.save()
    ctx.translate(-r * 1.1 * c.facing, r * 0.4)
    ctx.rotate(-c.facing * 0.3)
    ctx.strokeStyle = '#7a5230'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, -r * 1.6)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, -r * 1.7, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ff9d4d'
    ctx.fill()
    ctx.restore()
    // 귀(뾰족)
    ctx.beginPath()
    ctx.moveTo(-r * 0.5, -r * 1.15)
    ctx.lineTo(-r * 0.15, -r * 1.7)
    ctx.lineTo(0, -r * 1.1)
    ctx.closePath()
    ctx.moveTo(r * 0.5, -r * 1.15)
    ctx.lineTo(r * 0.15, -r * 1.7)
    ctx.lineTo(0, -r * 1.1)
    ctx.closePath()
    ctx.fillStyle = c.def.accentColor
    ctx.fill()
  }
}

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  if (!ball.inPlay) return
  ctx.save()

  // 잔상
  for (let i = 0; i < ball.trail.length; i++) {
    const p = ball.trail[i]
    const a = (i / ball.trail.length) * 0.35
    ctx.globalAlpha = a
    ctx.beginPath()
    ctx.arc(p.x, p.y, ball.radius * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = ball.isSkillShot ? ball.skillColor : '#fff59d'
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const scale = ball.arcScale
  ctx.beginPath()
  ctx.ellipse(ball.x, ball.y + ball.radius * 0.9, ball.radius * scale * 0.8, ball.radius * 0.35, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ball.x, ball.y, ball.radius * scale, 0, Math.PI * 2)
  ctx.fillStyle = ball.isSkillShot ? ball.skillColor : '#f4ff5e'
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()

  ctx.restore()
}

export function drawVignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.3,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.8,
  )
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.25)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
}
