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
// 동물 종 정의
// ---------------------------------------------------------------------------
export const SPECIES: SpeciesDef[] = [
  {
    id: 'rabbit',
    name: '토끼',
    biome: 'grassland',
    bodyColor: 0xf5f0e6,
    accentColor: 0xf0a6b0,
    scale: 0.55,
    wanderSpeed: 1.6,
    earType: 'long',
    tailType: 'stub',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'feather',
    cryFreq: 880,
    cryType: 'sine',
    cryLength: 0.12,
  },
  {
    id: 'chicken',
    name: '닭',
    biome: 'grassland',
    bodyColor: 0xffffff,
    accentColor: 0xe0523a,
    scale: 0.5,
    wanderSpeed: 1.3,
    earType: 'none',
    tailType: 'thin',
    hasHorns: false,
    hasBeak: true,
    legCount: 2,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'feather',
    cryFreq: 650,
    cryType: 'square',
    cryLength: 0.18,
  },
  {
    id: 'sheep',
    name: '양',
    biome: 'grassland',
    bodyColor: 0xf7f4ea,
    accentColor: 0x3a3530,
    scale: 0.85,
    wanderSpeed: 1.1,
    earType: 'floppy',
    tailType: 'fluffy',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'wool',
    cryFreq: 300,
    cryType: 'sawtooth',
    cryLength: 0.35,
  },
  {
    id: 'crab',
    name: '게',
    biome: 'coast',
    bodyColor: 0xd94f3d,
    accentColor: 0xb33a2b,
    scale: 0.45,
    wanderSpeed: 1.0,
    earType: 'none',
    tailType: 'none',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: true,
    requiredRopeTier: 0,
    dropItem: 'shell',
    cryFreq: 1200,
    cryType: 'square',
    cryLength: 0.08,
  },
  {
    id: 'duck',
    name: '오리',
    biome: 'coast',
    bodyColor: 0xf2d43d,
    accentColor: 0xe08a1e,
    scale: 0.5,
    wanderSpeed: 1.2,
    earType: 'none',
    tailType: 'thin',
    hasHorns: false,
    hasBeak: true,
    legCount: 2,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'feather',
    cryFreq: 500,
    cryType: 'triangle',
    cryLength: 0.2,
  },
  {
    id: 'seal',
    name: '물범',
    biome: 'coast',
    bodyColor: 0x9aa0a6,
    accentColor: 0x5c6066,
    scale: 0.9,
    wanderSpeed: 0.8,
    earType: 'none',
    tailType: 'stub',
    hasHorns: false,
    hasBeak: false,
    legCount: 0,
    flat: false,
    requiredRopeTier: 1,
    dropItem: 'shell',
    cryFreq: 220,
    cryType: 'sawtooth',
    cryLength: 0.4,
  },
  {
    id: 'goat',
    name: '염소',
    biome: 'mountain',
    bodyColor: 0xc9c3b8,
    accentColor: 0x4a4640,
    scale: 0.8,
    wanderSpeed: 1.4,
    earType: 'short',
    tailType: 'stub',
    hasHorns: true,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'fur',
    cryFreq: 340,
    cryType: 'sawtooth',
    cryLength: 0.3,
  },
  {
    id: 'fox',
    name: '여우',
    biome: 'mountain',
    bodyColor: 0xdd7a3a,
    accentColor: 0xf5f0e6,
    scale: 0.7,
    wanderSpeed: 2.0,
    earType: 'short',
    tailType: 'fluffy',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 1,
    dropItem: 'fur',
    cryFreq: 950,
    cryType: 'triangle',
    cryLength: 0.15,
  },
  {
    id: 'otter',
    name: '수달',
    biome: 'river',
    bodyColor: 0x8a5a3a,
    accentColor: 0xc9a56a,
    scale: 0.6,
    wanderSpeed: 1.8,
    earType: 'short',
    tailType: 'thin',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'reed',
    cryFreq: 700,
    cryType: 'triangle',
    cryLength: 0.12,
  },
  {
    id: 'frog',
    name: '개구리',
    biome: 'river',
    bodyColor: 0x6ab04c,
    accentColor: 0xd9e88a,
    scale: 0.4,
    wanderSpeed: 1.0,
    earType: 'none',
    tailType: 'none',
    hasHorns: false,
    hasBeak: false,
    legCount: 4,
    flat: false,
    requiredRopeTier: 0,
    dropItem: 'reed',
    cryFreq: 400,
    cryType: 'square',
    cryLength: 0.1,
  },
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
    desc: '농장 우리에 5마리를 더 키울 수 있어요.',
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
  fur: '🦊',
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

export const BASE_PEN_CAPACITY = 10
export const BASE_ROPE_COUNT = 1

export function xpToNextLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.3) + 20)
}
