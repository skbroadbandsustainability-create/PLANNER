import type { CharacterDef, PokemonId, SkillDef } from './types.ts'

// 개굴닌자 - 물 타입 + 분신술(닌자) 컨셉
const greninja: CharacterDef = {
  id: 'greninja',
  name: '개굴닌자',
  typeLabel: '물 / 어둠',
  color: '#2f6fb0',
  megaColor: '#7fd6ff',
  accentColor: '#e23b3b',
  baseHp: 90,
  baseSpeed: 235,
  radius: 22,
  description: '재빠른 몸놀림의 물의 닌자. 스피드가 빠르고 견제기가 강하다.',
  skills: [
    {
      id: 'water-shuriken',
      name: '물수리검',
      element: 'water',
      description: '물로 만든 수리검을 빠르게 날려 상대를 맞춘다.',
      baseDamage: 14,
      damagePerLevel: 3,
      baseCooldown: 4.5,
      cooldownReducePerLevel: 0.35,
      minCooldown: 2.2,
      maxLevel: 5,
      baseCost: 40,
      costGrowth: 1.6,
      color: '#4fc3f7',
    },
    {
      id: 'shadow-clone',
      name: '분신술',
      element: 'clone',
      description: '분신을 만들어 반격 범위를 넓히고, 명중 시 치명타를 입힌다.',
      baseDamage: 20,
      damagePerLevel: 4,
      baseCooldown: 9,
      cooldownReducePerLevel: 0.6,
      minCooldown: 5,
      maxLevel: 5,
      baseCost: 60,
      costGrowth: 1.7,
      color: '#8e6bc7',
    },
  ],
}

// 브리가론 - 격투/풀 타입(드럼 기반 파워) 컨셉
const rillaboom: CharacterDef = {
  id: 'rillaboom',
  name: '브리가론',
  typeLabel: '풀 / 격투',
  color: '#4a7a2c',
  megaColor: '#8fe34f',
  accentColor: '#c88a3a',
  baseHp: 115,
  baseSpeed: 195,
  radius: 25,
  description: '북을 두드려 강력한 힘을 내는 파워 타입. 체력이 높고 한 방이 강하다.',
  skills: [
    {
      id: 'drum-smash',
      name: '드럼 스매시',
      element: 'fighting',
      description: '북을 두드려 만든 충격파로 강하게 후려친다. 데미지가 매우 높다.',
      baseDamage: 22,
      damagePerLevel: 4.5,
      baseCooldown: 6,
      cooldownReducePerLevel: 0.45,
      minCooldown: 3.2,
      maxLevel: 5,
      baseCost: 45,
      costGrowth: 1.6,
      color: '#e08a2b',
    },
    {
      id: 'grass-vine',
      name: '그래스 바인',
      element: 'grass',
      description: '덩굴로 감싼 공을 날려 명중 시 상대를 휘감아 이동속도를 늦춘다.',
      baseDamage: 12,
      damagePerLevel: 2.5,
      baseCooldown: 5,
      cooldownReducePerLevel: 0.35,
      minCooldown: 2.6,
      maxLevel: 5,
      baseCost: 40,
      costGrowth: 1.6,
      color: '#63c23a',
      status: { kind: 'root', duration: 2.6, tickInterval: 0 },
    },
  ],
}

// 마폭시 - 불/에스퍼 타입 컨셉
const delphox: CharacterDef = {
  id: 'delphox',
  name: '마폭시',
  typeLabel: '불꽃 / 에스퍼',
  color: '#c25a2c',
  megaColor: '#ffb15e',
  accentColor: '#8452c9',
  baseHp: 95,
  baseSpeed: 215,
  radius: 23,
  description: '불꽃과 초능력을 함께 다루는 마법사 타입. 상태 이상으로 상대를 흔든다.',
  skills: [
    {
      id: 'mystical-fire',
      name: '매지컬파이어',
      element: 'fire',
      description: '신비한 불꽃을 날려 맞으면 화상을 입혀 지속 피해를 준다.',
      baseDamage: 13,
      damagePerLevel: 2.8,
      baseCooldown: 4.5,
      cooldownReducePerLevel: 0.3,
      minCooldown: 2.4,
      maxLevel: 5,
      baseCost: 40,
      costGrowth: 1.6,
      color: '#ff7a3d',
      status: { kind: 'burn', duration: 3, tickDamage: 3, tickInterval: 0.6 },
    },
    {
      id: 'psychic-curve',
      name: '사이코키네시스',
      element: 'psychic',
      description: '공을 초능력으로 띄워 궤도를 흔들어 보내며, 맞으면 조작이 잠시 뒤엉킨다.',
      baseDamage: 16,
      damagePerLevel: 3.2,
      baseCooldown: 7,
      cooldownReducePerLevel: 0.5,
      minCooldown: 3.8,
      maxLevel: 5,
      baseCost: 55,
      costGrowth: 1.65,
      color: '#a86bff',
      status: { kind: 'confuse', duration: 2.2 },
    },
  ],
}

export const CHARACTERS: Record<PokemonId, CharacterDef> = {
  greninja,
  rillaboom,
  delphox,
}

export const CHARACTER_LIST: CharacterDef[] = [greninja, rillaboom, delphox]

export function getCharacter(id: PokemonId): CharacterDef {
  return CHARACTERS[id]
}

export function skillDamageAtLevel(skill: SkillDef, level: number): number {
  if (level <= 0) return 0
  return skill.baseDamage + skill.damagePerLevel * (level - 1)
}

export function skillCooldownAtLevel(skill: SkillDef, level: number): number {
  if (level <= 0) return Infinity
  return Math.max(skill.minCooldown, skill.baseCooldown - skill.cooldownReducePerLevel * (level - 1))
}
