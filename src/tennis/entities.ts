import type { CharacterDef, StatusEffect, StatusEffectKind } from './types.ts'
import {
  AI_MAX_Z,
  AI_MIN_Z,
  BALL_PEAK_HEIGHT,
  BALL_RADIUS,
  CHAR_MAX_X,
  CHAR_MIN_X,
  PLAYER_MAX_Z,
  PLAYER_MIN_Z,
  WALL_X,
} from './constants.ts'

export type Side = 'player' | 'ai'

export class Character {
  def: CharacterDef
  side: Side
  x: number
  z: number
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
    z: number,
    level: number,
    skillLevels: Record<string, number>,
  ) {
    this.def = def
    this.side = side
    this.x = x
    this.z = z
    // player는 네트를 향해(-z) 바라보고, ai는 반대(+z)를 바라본다
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
    return this.def.baseSpeed + (this.level - 1) * 0.06
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

  moveBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return {
      minX: CHAR_MIN_X,
      maxX: CHAR_MAX_X,
      minZ: this.side === 'player' ? PLAYER_MIN_Z : AI_MIN_Z,
      maxZ: this.side === 'player' ? PLAYER_MAX_Z : AI_MAX_Z,
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
  z: number
  vx = 0
  vz = 0
  radius = BALL_RADIUS
  lastHitBy: Side | null = null
  isSkillShot = false
  skillElement: string | null = null
  skillColor = '#ffffff'
  skillDamage = 0
  pendingStatus: StatusEffect | null = null
  trail: { x: number; z: number; y: number }[] = []
  flightTime = 0
  /** 이 타구가 목표 지점까지 도달하는 데 걸릴 것으로 예상되는 시간(초). 포물선 아치 계산용. */
  flightDuration = 1
  inPlay = false

  constructor(x: number, z: number) {
    this.x = x
    this.z = z
  }

  launch(vx: number, vz: number, hitBy: Side | null, flightDuration: number): void {
    this.vx = vx
    this.vz = vz
    this.lastHitBy = hitBy
    this.flightTime = 0
    this.flightDuration = Math.max(0.2, flightDuration)
    this.inPlay = true
    this.trail = []
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
    this.trail.push({ x: this.x, z: this.z, y: this.height })
    if (this.trail.length > 12) this.trail.shift()

    this.x += this.vx * dt
    this.z += this.vz * dt

    if (this.x - this.radius < -WALL_X) {
      this.x = -WALL_X + this.radius
      this.vx = Math.abs(this.vx)
    } else if (this.x + this.radius > WALL_X) {
      this.x = WALL_X - this.radius
      this.vx = -Math.abs(this.vx)
    }
  }

  /** 포물선 아치의 현재 높이(월드 단위). 실제 중력 낙하 공식을 이용해 자연스러운 궤적을 만든다. */
  get height(): number {
    const t = this.flightTime
    const T = this.flightDuration
    if (t >= T) return 0
    const u = t / T
    return 4 * BALL_PEAK_HEIGHT * u * (1 - u)
  }
}
