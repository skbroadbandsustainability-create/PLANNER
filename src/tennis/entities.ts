import type { CharacterDef, StatusEffect, StatusEffectKind } from './types.ts'
import {
  AI_MAX_Y,
  AI_MIN_Y,
  CHAR_MAX_X,
  CHAR_MIN_X,
  PLAYER_MAX_Y,
  PLAYER_MIN_Y,
  WALL_LEFT,
  WALL_RIGHT,
} from './constants.ts'

export type Side = 'player' | 'ai'

export class Character {
  def: CharacterDef
  side: Side
  x: number
  y: number
  facing: -1 | 1
  maxHp: number
  hp: number
  level: number
  skillLevels: Record<string, number>
  cooldowns: Record<string, number> = {}
  isMega = false
  megaGauge = 0
  stunTimer = 0
  statusEffects: StatusEffect[] = []
  swingAnim = 0
  hitFlash = 0
  celebrateTimer = 0

  constructor(
    def: CharacterDef,
    side: Side,
    x: number,
    y: number,
    level: number,
    skillLevels: Record<string, number>,
  ) {
    this.def = def
    this.side = side
    this.x = x
    this.y = y
    this.facing = side === 'player' ? -1 : 1
    this.level = level
    this.skillLevels = skillLevels
    this.maxHp = Math.round(def.baseHp + (level - 1) * 6)
    this.hp = this.maxHp
    for (const s of def.skills) {
      this.cooldowns[s.id] = 0
    }
  }

  get baseSpeed(): number {
    return this.def.baseSpeed + (this.level - 1) * 4
  }

  get isRooted(): boolean {
    return this.statusEffects.some((e) => e.kind === 'root')
  }

  get isConfused(): boolean {
    return this.statusEffects.some((e) => e.kind === 'confuse')
  }

  get effectiveSpeed(): number {
    let s = this.baseSpeed
    if (this.isMega) s *= 1.35
    if (this.isRooted) s *= 0.42
    return s
  }

  get outgoingSpeedMultiplier(): number {
    return this.isMega ? 1.28 : 1
  }

  hasStatus(kind: StatusEffectKind): boolean {
    return this.statusEffects.some((e) => e.kind === kind)
  }

  applyStatus(effect: StatusEffect): void {
    const existing = this.statusEffects.find((e) => e.kind === effect.kind)
    if (existing) {
      existing.timeLeft = Math.max(existing.timeLeft, effect.timeLeft)
    } else {
      this.statusEffects.push({ ...effect })
    }
  }

  clearStatusEffects(): void {
    this.statusEffects = []
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
    this.hitFlash = 0.35
  }

  isStunned(): boolean {
    return this.stunTimer > 0
  }

  moveBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: CHAR_MIN_X,
      maxX: CHAR_MAX_X,
      minY: this.side === 'player' ? PLAYER_MIN_Y : AI_MIN_Y,
      maxY: this.side === 'player' ? PLAYER_MAX_Y : AI_MAX_Y,
    }
  }

  update(dt: number): void {
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt)
    }
    if (this.stunTimer > 0) this.stunTimer = Math.max(0, this.stunTimer - dt)
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - dt)
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt)
    if (this.celebrateTimer > 0) this.celebrateTimer = Math.max(0, this.celebrateTimer - dt)

    let burnDamageThisFrame = 0
    for (const effect of this.statusEffects) {
      effect.timeLeft -= dt
      if (effect.kind === 'burn' && effect.tickDamage && effect.tickInterval !== undefined) {
        effect.tickTimer = (effect.tickTimer ?? 0) + dt
        if (effect.tickTimer >= effect.tickInterval) {
          effect.tickTimer = 0
          burnDamageThisFrame += effect.tickDamage
        }
      }
    }
    if (burnDamageThisFrame > 0 && this.hp > 0) {
      this.takeDamage(burnDamageThisFrame)
    }
    this.statusEffects = this.statusEffects.filter((e) => e.timeLeft > 0)
  }

  resetForRound(): void {
    this.hp = this.maxHp
    this.stunTimer = 0
    this.clearStatusEffects()
  }

  resetForMatch(): void {
    this.hp = this.maxHp
    this.stunTimer = 0
    this.isMega = false
    this.megaGauge = 0
    this.clearStatusEffects()
    for (const id of Object.keys(this.cooldowns)) this.cooldowns[id] = 0
  }
}

export class Ball {
  x: number
  y: number
  vx = 0
  vy = 0
  radius = 9
  lastHitBy: Side | null = null
  isSkillShot = false
  skillElement: string | null = null
  skillColor = '#ffffff'
  skillDamage = 0
  pendingStatus: StatusEffect | null = null
  trail: { x: number; y: number }[] = []
  flightTime = 0
  inPlay = false

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  launch(vx: number, vy: number, hitBy: Side | null): void {
    this.vx = vx
    this.vy = vy
    this.lastHitBy = hitBy
    this.flightTime = 0
    this.inPlay = true
  }

  clearSkill(): void {
    this.isSkillShot = false
    this.skillElement = null
    this.skillDamage = 0
    this.pendingStatus = null
  }

  update(dt: number): void {
    if (!this.inPlay) return
    this.flightTime += dt
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > 10) this.trail.shift()

    this.x += this.vx * dt
    this.y += this.vy * dt

    if (this.x - this.radius < WALL_LEFT) {
      this.x = WALL_LEFT + this.radius
      this.vx = Math.abs(this.vx)
    } else if (this.x + this.radius > WALL_RIGHT) {
      this.x = WALL_RIGHT - this.radius
      this.vx = -Math.abs(this.vx)
    }
  }

  /** 시각적 궤적 아치 높이(0~1) - 서브/랠리 중간에 살짝 떠 보이도록 */
  get arcScale(): number {
    const t = Math.min(1, this.flightTime / 0.9)
    return 1 + Math.sin(t * Math.PI) * 0.5
  }
}
