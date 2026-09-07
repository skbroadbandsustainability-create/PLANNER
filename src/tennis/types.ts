// 몬스터 테니스 게임에서 쓰이는 공용 타입 정의

export type MonsterId = 'abysnaga' | 'drumjaw' | 'ignisphere'

export type SkillElement = 'water' | 'clone' | 'fighting' | 'grass' | 'fire' | 'psychic'

export type StatusEffectKind = 'root' | 'burn' | 'confuse'

export interface StatusEffect {
  kind: StatusEffectKind
  timeLeft: number
  /** burn 틱 데미지 등 부가 정보 */
  tickDamage?: number
  tickInterval?: number
  tickTimer?: number
}

export interface SkillDef {
  id: string
  name: string
  element: SkillElement
  description: string
  baseDamage: number
  damagePerLevel: number
  baseCooldown: number
  cooldownReducePerLevel: number
  minCooldown: number
  maxLevel: number
  baseCost: number
  costGrowth: number
  color: string
  /** 스킬이 적중했을 때 상대에게 거는 상태 효과 */
  status?: {
    kind: StatusEffectKind
    duration: number
    tickDamage?: number
    tickInterval?: number
  }
}

export interface CharacterDef {
  id: MonsterId
  name: string
  typeLabel: string
  color: string
  megaColor: string
  accentColor: string
  baseHp: number
  baseSpeed: number
  radius: number
  skills: readonly [SkillDef, SkillDef]
  description: string
}

export type GameStateName =
  | 'menu'
  | 'select'
  | 'howto'
  | 'shop'
  | 'playing'
  | 'pointResult'
  | 'matchResult'
  | 'paused'

export interface Vec2 {
  x: number
  y: number
}
