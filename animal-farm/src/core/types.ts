// 게임 전역에서 쓰이는 타입 정의 모음

export type BiomeId = 'farm' | 'grassland' | 'coast' | 'mountain' | 'river'

export type ItemId =
  | 'feed' // 사료
  | 'wool' // 양털
  | 'feather' // 깃털
  | 'shell' // 조개
  | 'reed' // 갈대
  | 'fur' // 모피
  | 'ropeThread' // 밧줄 재료(실)
  | 'wood' // 나무 (채집)
  | 'ore' // 광물 (채집)

export type EarType = 'long' | 'short' | 'floppy' | 'none'
export type TailType = 'fluffy' | 'thin' | 'stub' | 'paddle' | 'fan' | 'none'
export type WingType = 'none' | 'small' | 'large'
export type HornStyle = 'straight' | 'antler'

/**
 * 몸체의 기본 형태.
 * quadruped/biped/flat(게)은 기존 사족보행/이족보행/납작 몸통 방식이고,
 * shell/clamshell/starfish/octopus/fish/serpent/insect는 새로 추가된 특수 체형이다.
 */
export type BodyShape =
  | 'quadruped'
  | 'biped'
  | 'flat'
  | 'shell'
  | 'clamshell'
  | 'starfish'
  | 'octopus'
  | 'fish'
  | 'serpent'
  | 'insect'

export interface SpeciesDef {
  id: string
  name: string // 표시 이름 (한글)
  biome: BiomeId
  bodyColor: number
  accentColor: number
  scale: number
  wanderSpeed: number
  bodyShape: BodyShape
  earType: EarType
  tailType: TailType
  wingType: WingType
  hasHorns: boolean
  hornStyle: HornStyle
  hasBeak: boolean
  hasLongNeck: boolean // 두루미/왜가리처럼 목이 긴 경우
  legCount: 4 | 2 | 0
  swimsInWater: boolean // true면 바이옴의 물 영역 안에서만 서식한다
  canBurrow: boolean // true면 조개/게처럼 주기적으로 땅속에 숨었다가 다시 나타난다
  requiredRopeTier: number // 포획에 필요한 최소 밧줄 등급 (0=기본)
  dropItem: ItemId
  cryFreq: number // 울음 소리 기본 주파수(Hz)
  cryType: OscillatorType
  cryLength: number // 울음 소리 길이(초)
}

export interface BiomeDef {
  id: BiomeId
  name: string
  groundColor: number
  center: { x: number; z: number }
  halfSize: number
}

export interface RopeTierDef {
  id: number
  name: string
  range: number // 포획 가능 거리
  dragSpeed: number // 동물을 끌어오는 속도 배율
  recipe: Partial<Record<ItemId, number>> | null // null이면 최초 장비(제작 불필요)
}

export type SkillId =
  | 'legwork' // 걸음 숙련: 이동속도 증가
  | 'lassoMastery' // 밧줄 숙달: 포획 반경 증가
  | 'animalBond' // 동물 친화: 끄는 속도 증가
  | 'penExpansion' // 우리 확장: 수용량 증가
  | 'multiLasso' // 다중 포획: 동시 포획 수 증가

export interface SkillDef {
  id: SkillId
  name: string
  desc: string
  cost: number // 필요 스킬 포인트
  requires: SkillId[]
}

export interface QuestDef {
  id: string
  speciesId: string
  tier: 1 | 2
  target: number
  rewardXp: number
  rewardItem: ItemId
  rewardItemAmount: number
}

export interface InventoryState {
  [itemId: string]: number
}
