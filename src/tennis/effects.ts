// 파티클/이펙트 시스템: 타격 이펙트, 스킬 연출, 점수 이펙트, 라켓 히트 이펙트

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
  shape: 'circle' | 'spark' | 'leaf' | 'star'
  rotation: number
  rotationSpeed: number
}

interface FloatingText {
  x: number
  y: number
  vy: number
  life: number
  maxLife: number
  text: string
  color: string
  size: number
}

interface RingEffect {
  x: number
  y: number
  life: number
  maxLife: number
  color: string
  maxRadius: number
}

export class EffectSystem {
  private particles: Particle[] = []
  private texts: FloatingText[] = []
  private rings: RingEffect[] = []
  screenShake = 0

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.rotationSpeed * dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)

    for (const t of this.texts) {
      t.life -= dt
      t.y += t.vy * dt
      t.vy *= 0.96
    }
    this.texts = this.texts.filter((t) => t.life > 0)

    for (const r of this.rings) {
      r.life -= dt
    }
    this.rings = this.rings.filter((r) => r.life > 0)

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 18)
    }
  }

  addShake(amount: number): void {
    this.screenShake = Math.min(14, this.screenShake + amount)
  }

  /** 라켓에 공이 맞았을 때의 소박한 임팩트 이펙트 */
  spawnRacketHit(x: number, y: number, color: string): void {
    this.rings.push({ x, y, life: 0.22, maxLife: 0.22, color: '#ffffff', maxRadius: 26 })
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5
      const speed = 60 + Math.random() * 60
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.25,
        maxLife: 0.25,
        size: 3 + Math.random() * 2,
        color,
        gravity: 0,
        shape: 'spark',
        rotation: 0,
        rotationSpeed: 0,
      })
    }
  }

  /** 타입별 스킬 발동 이펙트 */
  spawnSkillCast(x: number, y: number, element: string, color: string): void {
    this.rings.push({ x, y, life: 0.3, maxLife: 0.3, color, maxRadius: 46 })
    const count = element === 'clone' ? 4 : 10
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 90
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.5 + Math.random() * 0.3,
        size: element === 'grass' ? 6 : 4,
        color,
        gravity: element === 'fire' ? -20 : 60,
        shape: element === 'grass' ? 'leaf' : element === 'psychic' ? 'star' : 'circle',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 6,
      })
    }
  }

  /** 상대에게 스킬이 명중했을 때 데미지 이펙트 */
  spawnHitImpact(x: number, y: number, color: string): void {
    this.addShake(6)
    this.rings.push({ x, y, life: 0.35, maxLife: 0.35, color: '#ffffff', maxRadius: 60 })
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 80 + Math.random() * 140
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 3 + Math.random() * 3,
        color,
        gravity: 100,
        shape: 'spark',
        rotation: 0,
        rotationSpeed: 0,
      })
    }
  }

  spawnDamageText(x: number, y: number, amount: number): void {
    this.texts.push({
      x,
      y,
      vy: -70,
      life: 0.9,
      maxLife: 0.9,
      text: `-${Math.round(amount)}`,
      color: '#ff5252',
      size: 22,
    })
  }

  spawnScoreText(x: number, y: number, text: string, color: string): void {
    this.texts.push({ x, y, vy: -50, life: 1.1, maxLife: 1.1, text, color, size: 26 })
  }

  spawnConfetti(x: number, y: number): void {
    const colors = ['#ffd54f', '#ff7043', '#4fc3f7', '#81c784', '#ba68c8']
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 80 + Math.random() * 160
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 0.8 + Math.random() * 0.5,
        size: 4 + Math.random() * 3,
        color: colors[i % colors.length],
        gravity: 220,
        shape: 'star',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 8,
      })
    }
  }

  clear(): void {
    this.particles = []
    this.texts = []
    this.rings = []
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    for (const r of this.rings) {
      const t = 1 - r.life / r.maxLife
      ctx.globalAlpha = Math.max(0, 1 - t)
      ctx.strokeStyle = r.color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(r.x, r.y, 4 + t * r.maxRadius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    for (const p of this.particles) {
      const t = p.life / p.maxLife
      ctx.globalAlpha = Math.max(0, t)
      ctx.fillStyle = p.color
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else if (p.shape === 'spark') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      } else if (p.shape === 'leaf') {
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        drawStar(ctx, 0, 0, p.size, p.size * 0.45)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1

    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife)
      ctx.globalAlpha = a
      ctx.font = `bold ${t.size}px 'Jua', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillStyle = t.color
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 3
      ctx.strokeText(t.text, t.x, t.y)
      ctx.fillText(t.text, t.x, t.y)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}
