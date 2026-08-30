import type { BiomeDef, ItemId, QuestDef, RopeTierDef, SkillDef, SpeciesDef } from './types.ts'

// ---------------------------------------------------------------------------
// 바이옴 (지역) 정의: 농장 허브를 중심으로 동서남북에 4개의 자연 지역 배치
// ---------------------------------------------------------------------------
export const BIOMES: Record<string, BiomeDef> = {
  farm: { id: 'farm', name: '농장', groundColor: 0x8fce7a, center: { x: 0, z: 0 }, halfSize: 16 },
  grassland: {
    id: 'grassland',
    name: '초원',
    groundColor: 0x7bc95a,
    center: { x: 0, z: -55 },
    halfSize: 32,
  },
  coast: {
    id: 'coast',
    name: '바다',
    groundColor: 0xe4d9a5,
    center: { x: 55, z: 0 },
    halfSize: 32,
  },
  mountain: {
    id: 'mountain',
    name: '산',
    groundColor: 0x9a9a92,
    center: { x: 0, z: 55 },
    halfSize: 32,
  },
  river: {
    id: 'river',
    name: '강',
    groundColor: 0x8fc46a,
    center: { x: -55, z: 0 },
    halfSize: 32,
  },
}

// ---------------------------------------------------------------------------
// 동물 종 정의 - 지역마다 10종씩, 총 40종
// ---------------------------------------------------------------------------

/** 대부분의 종이 공유하는 기본값. 개별 종 정의에서는 다른 값만 덮어쓰면 된다. */
const SPECIES_DEFAULTS = {
  bodyShape: 'quadruped' as const,
  earType: 'none' as const,
  tailType: 'none' as const,
  wingType: 'none' as const,
  hasHorns: false,
  hornStyle: 'straight' as const,
  hasBeak: false,
  hasLongNeck: false,
  legCount: 4 as const,
  swimsInWater: false,
}

function mkSpecies(
  def: Pick<
    SpeciesDef,
    | 'id'
    | 'name'
    | 'biome'
    | 'bodyColor'
    | 'accentColor'
    | 'scale'
    | 'wanderSpeed'
    | 'requiredRopeTier'
    | 'dropItem'
    | 'cryFreq'
    | 'cryType'
    | 'cryLength'
  > &
    Partial<SpeciesDef>,
): SpeciesDef {
  return { ...SPECIES_DEFAULTS, ...def }
}

export const SPECIES: SpeciesDef[] = [
  // ----- 초원 (grassland) -----
  mkSpecies({
    id: 'rabbit', name: '토끼', biome: 'grassland',
    bodyColor: 0xf5f0e6, accentColor: 0xf0a6b0, scale: 0.55, wanderSpeed: 1.6,
    earType: 'long', tailType: 'stub',
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 880, cryType: 'sine', cryLength: 0.12,
  }),
  mkSpecies({
    id: 'chicken', name: '닭', biome: 'grassland',
    bodyColor: 0xffffff, accentColor: 0xe0523a, scale: 0.5, wanderSpeed: 1.3,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 650, cryType: 'square', cryLength: 0.18,
  }),
  mkSpecies({
    id: 'sheep', name: '양', biome: 'grassland',
    bodyColor: 0xf7f4ea, accentColor: 0x3a3530, scale: 0.85, wanderSpeed: 1.1,
    earType: 'floppy', tailType: 'fluffy',
    requiredRopeTier: 0, dropItem: 'wool', cryFreq: 300, cryType: 'sawtooth', cryLength: 0.35,
  }),
  mkSpecies({
    id: 'cow', name: '소', biome: 'grassland',
    bodyColor: 0xf2f0e6, accentColor: 0x3a3530, scale: 1.3, wanderSpeed: 0.9,
    earType: 'short', tailType: 'thin', hasHorns: true,
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 160, cryType: 'sawtooth', cryLength: 0.5,
  }),
  mkSpecies({
    id: 'horse', name: '말', biome: 'grassland',
    bodyColor: 0x7a5233, accentColor: 0x2b1f14, scale: 1.2, wanderSpeed: 2.2,
    earType: 'short', tailType: 'fluffy',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 380, cryType: 'sawtooth', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'mole', name: '두더지', biome: 'grassland',
    bodyColor: 0x6b5b52, accentColor: 0xd9a9a0, scale: 0.35, wanderSpeed: 0.9,
    tailType: 'thin',
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 500, cryType: 'square', cryLength: 0.08,
  }),
  mkSpecies({
    id: 'goose', name: '거위', biome: 'grassland',
    bodyColor: 0xf5f4ee, accentColor: 0xe8942e, scale: 0.65, wanderSpeed: 1.3,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 600, cryType: 'sawtooth', cryLength: 0.22,
  }),
  mkSpecies({
    id: 'turkey', name: '칠면조', biome: 'grassland',
    bodyColor: 0x5c4a3a, accentColor: 0xc0392b, scale: 0.65, wanderSpeed: 1.1,
    bodyShape: 'biped', tailType: 'fan', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 420, cryType: 'sawtooth', cryLength: 0.25,
  }),
  mkSpecies({
    id: 'donkey', name: '당나귀', biome: 'grassland',
    bodyColor: 0x9a9088, accentColor: 0xe8e4da, scale: 1.0, wanderSpeed: 1.3,
    earType: 'long', tailType: 'thin',
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 260, cryType: 'sawtooth', cryLength: 0.4,
  }),
  mkSpecies({
    id: 'lark', name: '종달새', biome: 'grassland',
    bodyColor: 0xc9b27a, accentColor: 0x8a6f3a, scale: 0.35, wanderSpeed: 1.8,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 1400, cryType: 'triangle', cryLength: 0.14,
  }),

  // ----- 바다 (coast) -----
  mkSpecies({
    id: 'crab', name: '게', biome: 'coast',
    bodyColor: 0xd94f3d, accentColor: 0xb33a2b, scale: 0.45, wanderSpeed: 1.0,
    bodyShape: 'flat',
    requiredRopeTier: 0, dropItem: 'shell', cryFreq: 1200, cryType: 'square', cryLength: 0.08,
  }),
  mkSpecies({
    id: 'seal', name: '물범', biome: 'coast',
    bodyColor: 0x9aa0a6, accentColor: 0x5c6066, scale: 0.9, wanderSpeed: 0.8,
    tailType: 'stub', legCount: 0,
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 220, cryType: 'sawtooth', cryLength: 0.4,
  }),
  mkSpecies({
    id: 'seagull', name: '갈매기', biome: 'coast',
    bodyColor: 0xf5f5f0, accentColor: 0xe8942e, scale: 0.5, wanderSpeed: 2.0,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'large',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 900, cryType: 'triangle', cryLength: 0.18,
  }),
  mkSpecies({
    id: 'pelican', name: '펠리컨', biome: 'coast',
    bodyColor: 0xe8e4d8, accentColor: 0xe8942e, scale: 0.85, wanderSpeed: 1.4,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'large',
    requiredRopeTier: 1, dropItem: 'feather', cryFreq: 320, cryType: 'sawtooth', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'starfish', name: '불가사리', biome: 'coast',
    bodyColor: 0xe8804a, accentColor: 0xb85a2e, scale: 0.35, wanderSpeed: 0.3,
    bodyShape: 'starfish', swimsInWater: true, legCount: 0,
    requiredRopeTier: 0, dropItem: 'shell', cryFreq: 700, cryType: 'sine', cryLength: 0.1,
  }),
  mkSpecies({
    id: 'seaturtle', name: '바다거북', biome: 'coast',
    bodyColor: 0x5a8a5a, accentColor: 0x3a5a3a, scale: 0.8, wanderSpeed: 0.5,
    bodyShape: 'shell', swimsInWater: true, legCount: 0,
    requiredRopeTier: 1, dropItem: 'shell', cryFreq: 180, cryType: 'sine', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'octopus', name: '문어', biome: 'coast',
    bodyColor: 0xb05a9a, accentColor: 0x7a3a6e, scale: 0.55, wanderSpeed: 0.7,
    bodyShape: 'octopus', swimsInWater: true, legCount: 0,
    requiredRopeTier: 2, dropItem: 'shell', cryFreq: 260, cryType: 'sine', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'clam', name: '조개', biome: 'coast',
    bodyColor: 0xe8e0d0, accentColor: 0xc9b8a0, scale: 0.3, wanderSpeed: 0.15,
    bodyShape: 'clamshell', swimsInWater: true, legCount: 0,
    requiredRopeTier: 0, dropItem: 'shell', cryFreq: 900, cryType: 'square', cryLength: 0.06,
  }),
  mkSpecies({
    id: 'seaotter', name: '해달', biome: 'coast',
    bodyColor: 0x8a6a4a, accentColor: 0xd9c2a0, scale: 0.55, wanderSpeed: 1.6,
    earType: 'short', tailType: 'thin',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 760, cryType: 'triangle', cryLength: 0.12,
  }),
  mkSpecies({
    id: 'plover', name: '물떼새', biome: 'coast',
    bodyColor: 0xe8e4d8, accentColor: 0x4a4640, scale: 0.35, wanderSpeed: 1.8,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 1100, cryType: 'triangle', cryLength: 0.1,
  }),

  // ----- 산 (mountain) -----
  mkSpecies({
    id: 'goat', name: '염소', biome: 'mountain',
    bodyColor: 0xc9c3b8, accentColor: 0x4a4640, scale: 0.8, wanderSpeed: 1.4,
    earType: 'short', tailType: 'stub', hasHorns: true,
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 340, cryType: 'sawtooth', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'fox', name: '여우', biome: 'mountain',
    bodyColor: 0xdd7a3a, accentColor: 0xf5f0e6, scale: 0.7, wanderSpeed: 2.0,
    earType: 'short', tailType: 'fluffy',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 950, cryType: 'triangle', cryLength: 0.15,
  }),
  mkSpecies({
    id: 'wolf', name: '늑대', biome: 'mountain',
    bodyColor: 0x7a7d80, accentColor: 0x4a4d50, scale: 0.9, wanderSpeed: 2.1,
    earType: 'short', tailType: 'thin',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 260, cryType: 'sawtooth', cryLength: 0.45,
  }),
  mkSpecies({
    id: 'bear', name: '곰', biome: 'mountain',
    bodyColor: 0x4a3a2e, accentColor: 0x2b2018, scale: 1.3, wanderSpeed: 1.2,
    earType: 'short', tailType: 'stub',
    requiredRopeTier: 2, dropItem: 'fur', cryFreq: 130, cryType: 'sawtooth', cryLength: 0.5,
  }),
  mkSpecies({
    id: 'deer', name: '사슴', biome: 'mountain',
    bodyColor: 0xb5854a, accentColor: 0xe8e0d0, scale: 0.95, wanderSpeed: 2.0,
    earType: 'short', tailType: 'stub', hasHorns: true, hornStyle: 'antler',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 420, cryType: 'triangle', cryLength: 0.25,
  }),
  mkSpecies({
    id: 'squirrel', name: '다람쥐', biome: 'mountain',
    bodyColor: 0xa0602e, accentColor: 0xe8d0a0, scale: 0.4, wanderSpeed: 2.1,
    earType: 'short', tailType: 'fluffy',
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 1300, cryType: 'square', cryLength: 0.08,
  }),
  mkSpecies({
    id: 'eagle', name: '독수리', biome: 'mountain',
    bodyColor: 0x5a4a3a, accentColor: 0xe8e0d0, scale: 0.8, wanderSpeed: 1.3,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'large',
    requiredRopeTier: 1, dropItem: 'feather', cryFreq: 780, cryType: 'sawtooth', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'owl', name: '부엉이', biome: 'mountain',
    bodyColor: 0x8a6f4a, accentColor: 0xe8d8a0, scale: 0.6, wanderSpeed: 1.0,
    bodyShape: 'biped', tailType: 'stub', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 240, cryType: 'triangle', cryLength: 0.35,
  }),
  mkSpecies({
    id: 'goral', name: '산양', biome: 'mountain',
    bodyColor: 0xd9d0c0, accentColor: 0x6b5f50, scale: 0.7, wanderSpeed: 1.5,
    earType: 'short', tailType: 'stub', hasHorns: true,
    requiredRopeTier: 0, dropItem: 'fur', cryFreq: 460, cryType: 'sawtooth', cryLength: 0.2,
  }),
  mkSpecies({
    id: 'lynx', name: '스라소니', biome: 'mountain',
    bodyColor: 0xc9a56a, accentColor: 0x8a6a3a, scale: 0.75, wanderSpeed: 1.9,
    earType: 'short', tailType: 'stub',
    requiredRopeTier: 2, dropItem: 'fur', cryFreq: 620, cryType: 'sawtooth', cryLength: 0.2,
  }),

  // ----- 강 (river) -----
  mkSpecies({
    id: 'otter', name: '수달', biome: 'river',
    bodyColor: 0x8a5a3a, accentColor: 0xc9a56a, scale: 0.6, wanderSpeed: 1.8,
    earType: 'short', tailType: 'thin',
    requiredRopeTier: 0, dropItem: 'reed', cryFreq: 700, cryType: 'triangle', cryLength: 0.12,
  }),
  mkSpecies({
    id: 'frog', name: '개구리', biome: 'river',
    bodyColor: 0x6ab04c, accentColor: 0xd9e88a, scale: 0.4, wanderSpeed: 1.0,
    requiredRopeTier: 0, dropItem: 'reed', cryFreq: 400, cryType: 'square', cryLength: 0.1,
  }),
  mkSpecies({
    id: 'beaver', name: '비버', biome: 'river',
    bodyColor: 0x6b4a30, accentColor: 0x3a2a1a, scale: 0.65, wanderSpeed: 1.2,
    earType: 'short', tailType: 'paddle',
    requiredRopeTier: 1, dropItem: 'fur', cryFreq: 320, cryType: 'square', cryLength: 0.15,
  }),
  mkSpecies({
    id: 'heron', name: '왜가리', biome: 'river',
    bodyColor: 0xc9d0d4, accentColor: 0x4a4640, scale: 0.85, wanderSpeed: 1.1,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, hasLongNeck: true, legCount: 2, wingType: 'large',
    requiredRopeTier: 2, dropItem: 'feather', cryFreq: 340, cryType: 'sawtooth', cryLength: 0.3,
  }),
  mkSpecies({
    id: 'duck', name: '오리', biome: 'river',
    bodyColor: 0xf2d43d, accentColor: 0xe08a1e, scale: 0.5, wanderSpeed: 1.2,
    bodyShape: 'biped', tailType: 'thin', hasBeak: true, legCount: 2, wingType: 'small',
    requiredRopeTier: 0, dropItem: 'feather', cryFreq: 500, cryType: 'triangle', cryLength: 0.2,
  }),
  mkSpecies({
    id: 'carp', name: '잉어', biome: 'river',
    bodyColor: 0xd9963a, accentColor: 0xf2d4a0, scale: 0.55, wanderSpeed: 0.9,
    bodyShape: 'fish', swimsInWater: true, legCount: 0,
    requiredRopeTier: 0, dropItem: 'reed', cryFreq: 500, cryType: 'sine', cryLength: 0.08,
  }),
  mkSpecies({
    id: 'softshellturtle', name: '자라', biome: 'river',
    bodyColor: 0x6b7a5a, accentColor: 0x4a5a3a, scale: 0.5, wanderSpeed: 0.6,
    bodyShape: 'shell', legCount: 0,
    requiredRopeTier: 0, dropItem: 'shell', cryFreq: 200, cryType: 'sine', cryLength: 0.25,
  }),
  mkSpecies({
    id: 'trout', name: '송어', biome: 'river',
    bodyColor: 0x8ab0c9, accentColor: 0xe8804a, scale: 0.45, wanderSpeed: 1.1,
    bodyShape: 'fish', swimsInWater: true, legCount: 0,
    requiredRopeTier: 1, dropItem: 'reed', cryFreq: 560, cryType: 'sine', cryLength: 0.08,
  }),
  mkSpecies({
    id: 'dragonfly', name: '잠자리', biome: 'river',
    bodyColor: 0x3a8a8a, accentColor: 0xd0e8e0, scale: 0.3, wanderSpeed: 2.4,
    bodyShape: 'insect', wingType: 'large', legCount: 0,
    requiredRopeTier: 0, dropItem: 'reed', cryFreq: 1600, cryType: 'sine', cryLength: 0.05,
  }),
  mkSpecies({
    id: 'snake', name: '뱀', biome: 'river',
    bodyColor: 0x5a7a3a, accentColor: 0xd9c24a, scale: 0.6, wanderSpeed: 1.3,
    bodyShape: 'serpent', legCount: 0,
    requiredRopeTier: 1, dropItem: 'reed', cryFreq: 2200, cryType: 'sawtooth', cryLength: 0.3,
  }),
]

export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(
  SPECIES.map((s) => [s.id, s]),
)

// ---------------------------------------------------------------------------
// 밧줄(장비) 등급 - 인벤토리 재료로 조합(제작)하여 업그레이드
// ---------------------------------------------------------------------------
export const ROPE_TIERS: RopeTierDef[] = [
  { id: 0, name: '기본 밧줄', range: 4, dragSpeed: 1.6, recipe: null },
  {
    id: 1,
    name: '강화 밧줄',
    range: 5.5,
    dragSpeed: 2.1,
    recipe: { ropeThread: 3, wool: 2 },
  },
  {
    id: 2,
    name: '황금 올가미',
    range: 7,
    dragSpeed: 2.8,
    recipe: { ropeThread: 5, fur: 3, shell: 2 },
  },
]

// ---------------------------------------------------------------------------
// 스킬 트리
// ---------------------------------------------------------------------------
export const SKILLS: SkillDef[] = [
  {
    id: 'legwork',
    name: '걸음 숙련',
    desc: '이동 속도가 15% 빨라져요.',
    cost: 1,
    requires: [],
  },
  {
    id: 'lassoMastery',
    name: '밧줄 숙달',
    desc: '밧줄이 닿는 거리가 늘어나요.',
    cost: 1,
    requires: [],
  },
  {
    id: 'animalBond',
    name: '동물 친화',
    desc: '데려오는 동물이 20% 더 빨리 따라와요.',
    cost: 2,
    requires: ['lassoMastery'],
  },
  {
    id: 'penExpansion',
    name: '우리 확장',
    desc: '농장 우리에 12마리를 더 키울 수 있어요.',
    cost: 2,
    requires: ['legwork'],
  },
  {
    id: 'multiLasso',
    name: '다중 포획',
    desc: '동시에 밧줄 2개를 사용할 수 있어요.',
    cost: 3,
    requires: ['animalBond', 'penExpansion'],
  },
]

export const SKILLS_BY_ID: Record<string, SkillDef> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s]),
)

// ---------------------------------------------------------------------------
// 퀘스트: 동물 종류별로 구조 목표를 부여 (2단계)
// ---------------------------------------------------------------------------
export const QUESTS: QuestDef[] = SPECIES.flatMap((s) => [
  {
    id: `${s.id}-1`,
    speciesId: s.id,
    tier: 1 as const,
    target: 2,
    rewardXp: 30,
    rewardItem: 'feed' as const,
    rewardItemAmount: 3,
  },
  {
    id: `${s.id}-2`,
    speciesId: s.id,
    tier: 2 as const,
    target: 5,
    rewardXp: 80,
    rewardItem: s.dropItem,
    rewardItemAmount: 3,
  },
])

export const ITEM_NAMES: Record<string, string> = {
  feed: '사료',
  wool: '양털',
  feather: '깃털',
  shell: '조개',
  reed: '갈대',
  fur: '모피',
  ropeThread: '밧줄실',
}

export const ITEM_EMOJI: Record<string, string> = {
  feed: '🌾',
  wool: '🧶',
  feather: '🪶',
  shell: '🐚',
  reed: '🌿',
  fur: '🐾',
  ropeThread: '🧵',
}

export interface ShopOffer {
  id: string
  give: Partial<Record<ItemId, number>>
  get: Partial<Record<ItemId, number>>
  label: string
}

/** NPC(사료 가게 아저씨)의 물물교환 목록: 재료를 사료로, 사료를 밧줄실로 교환 */
export const SHOP_OFFERS: ShopOffer[] = [
  { id: 'wool-feed', give: { wool: 2 }, get: { feed: 1 }, label: '양털 2개 → 사료 1개' },
  { id: 'feather-feed', give: { feather: 3 }, get: { feed: 1 }, label: '깃털 3개 → 사료 1개' },
  { id: 'shell-feed', give: { shell: 2 }, get: { feed: 1 }, label: '조개 2개 → 사료 1개' },
  { id: 'reed-feed', give: { reed: 3 }, get: { feed: 1 }, label: '갈대 3개 → 사료 1개' },
  { id: 'fur-feed', give: { fur: 2 }, get: { feed: 2 }, label: '모피 2개 → 사료 2개' },
  { id: 'feed-thread', give: { feed: 3 }, get: { ropeThread: 2 }, label: '사료 3개 → 밧줄실 2개' },
]

export const BASE_PEN_CAPACITY = 24
export const BASE_ROPE_COUNT = 1

export function xpToNextLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.3) + 20)
}
