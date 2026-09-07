// 화면(메뉴/상점 등)에 쓰이는 공통 드로잉 유틸리티 + 버튼 히트테스트

export interface Button {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  disabled?: boolean
}

export function pointInButton(px: number, py: number, b: Button): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// 아래 draw* 헬퍼들은 전부 ctx.save()/restore()로 감싸서 호출한 뒤에도
// textAlign/font/fillStyle 등이 호출부로 새어나가지 않도록 한다.

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = 'rgba(20,24,40,0.72)',
  stroke = 'rgba(255,255,255,0.18)',
): void {
  ctx.save()
  roundRect(ctx, x, y, w, h, 16)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = stroke
  ctx.stroke()
  ctx.restore()
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  b: Button,
  hover: boolean,
  accent = '#ffb347',
): void {
  ctx.save()
  roundRect(ctx, b.x, b.y, b.w, b.h, 12)
  if (b.disabled) {
    ctx.fillStyle = 'rgba(90,90,100,0.5)'
  } else {
    ctx.fillStyle = hover ? accent : 'rgba(255,255,255,0.14)'
  }
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = b.disabled ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.55)'
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = b.disabled ? 'rgba(255,255,255,0.4)' : hover ? '#20232b' : '#ffffff'
  ctx.font = "bold 17px 'Jua', sans-serif"
  ctx.fillText(b.label, b.x + b.w / 2, b.y + (b.sub ? b.h / 2 - 2 : b.h / 2 + 6))
  if (b.sub) {
    ctx.font = "13px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = b.disabled ? 'rgba(255,255,255,0.35)' : hover ? '#3a3d45' : 'rgba(255,255,255,0.85)'
    ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 16)
  }
  ctx.restore()
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fg: string,
  bg = 'rgba(0,0,0,0.45)',
): void {
  ctx.save()
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = bg
  ctx.fill()
  const clamped = Math.max(0, Math.min(1, ratio))
  if (clamped > 0) {
    roundRect(ctx, x, y, w * clamped, h, h / 2)
    ctx.fillStyle = fg
    ctx.fill()
  }
  roundRect(ctx, x, y, w, h, h / 2)
  ctx.lineWidth = 1.5
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.stroke()
  ctx.restore()
}

export function drawCooldownButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cooldownRatio: number,
  color: string,
  keyLabel: string,
  nameLabel: string,
  level: number,
  ready: boolean,
): void {
  ctx.save()
  roundRect(ctx, x, y, size, size, 12)
  ctx.fillStyle = level <= 0 ? 'rgba(60,60,70,0.6)' : 'rgba(10,12,20,0.75)'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = level <= 0 ? 'rgba(255,255,255,0.2)' : ready ? '#ffe066' : 'rgba(255,255,255,0.4)'
  ctx.stroke()

  if (level > 0) {
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.globalAlpha = ready ? 1 : 0.35
    ctx.fill()
    ctx.globalAlpha = 1

    if (cooldownRatio > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.moveTo(x + size / 2, y + size / 2)
      ctx.arc(
        x + size / 2,
        y + size / 2,
        size / 2 - 8,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * cooldownRatio,
      )
      ctx.closePath()
      ctx.fill()
    }
  }

  ctx.textAlign = 'center'
  ctx.font = "bold 13px 'Jua', sans-serif"
  ctx.fillStyle = '#ffffff'
  ctx.fillText(keyLabel, x + size / 2, y + size + 15)
  ctx.font = "11px 'Gowun Dodum', sans-serif"
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const label = level > 0 ? `${nameLabel} Lv${level}` : `${nameLabel} (미해금)`
  ctx.fillText(label, x + size / 2, y + size + 30)
  ctx.restore()
}
