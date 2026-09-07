import type { CharacterDef, MonsterId, SkillDef } from './types.ts'

// 아비스나가 - 심해에서 올라온 그림자 뱀 괴수 (물/그림자 타입)
const abysnaga: CharacterDef = {
  id: 'abysnaga',
  name: '아비스나가',
  typeLabel: '물 / 그림자',
  color: '#16233f',
  megaColor: '#5be6ff',
  accentColor: '#37e6e0',
  baseHp: 90,
  baseSpeed: 4.6,
  radius: 0.58,
  description: '심해에서 기어 올라온 그림자 뱀 괴수. 날렵하게 미끄러지듯 움직이며 환영으로 상대를 현혹한다.',
  skills: [
    {
      id: 'tidal-fang',
      name: '해일 수리검',
      element: 'water',
      description: '소용돌이치는 물의 칼날을 빠르게 날려 상대를 가격한다.',
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
      id: 'after-image',
      name: '잔영분신',
      element: 'clone',
      description: '그림자 분신을 만들어 반격 범위를 넓히고, 명중 시 치명타를 입힌다.',
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

// 드럼조우 - 가슴의 북을 두드려 힘을 폭발시키는 거구의 야수 (풀/격투 타입)
const drumjaw: CharacterDef = {
  id: 'drumjaw',
  name: '드럼조우',
  typeLabel: '풀 / 격투',
  color: '#4b3b25',
  megaColor: '#b6ff5a',
  accentColor: '#8a5a2b',
  baseHp: 115,
  baseSpeed: 3.6,
  radius: 0.75,
  description: '가슴의 북을 두드려 힘을 폭발시키는 거구의 야수. 체력이 높고 한 방이 강하다.',
  skills: [
    {
      id: 'drum-smash',
      name: '드럼 스매시',
      element: 'fighting',
      description: '가슴 북을 두드려 만든 충격파로 강하게 후려친다. 데미지가 매우 높다.',
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
      id: 'thorn-vine',
      name: '가시덩굴',
      element: 'grass',
      description: '가시 돋친 덩굴로 감싼 공을 날려 명중 시 상대를 휘감아 이동속도를 늦춘다.',
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

// 이그니스피어 - 불꽃과 정신력을 다루는 부유 정령 괴수 (불꽃/에스퍼 타입)
const ignisphere: CharacterDef = {
  id: 'ignisphere',
  name: '이그니스피어',
  typeLabel: '불꽃 / 에스퍼',
  color: '#2a1240',
  megaColor: '#ffb15e',
  accentColor: '#ff6a2b',
  baseHp: 95,
  baseSpeed: 4.2,
  radius: 0.62,
  description: '몸이 없이 불꽃과 정신력만으로 떠다니는 정령 괴수. 상태 이상으로 상대를 흔든다.',
  skills: [
    {
      id: 'soul-flame',
      name: '혼백화염',
      element: 'fire',
      description: '혼을 태우는 신비한 불꽃을 날려 맞으면 화상을 입혀 지속 피해를 준다.',
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
      id: 'mind-wave',
      name: '염동파동',
      element: 'psychic',
      description: '염동력으로 공의 궤도를 뒤흔들어 보내며, 맞으면 조작이 잠시 뒤엉킨다.',
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

export const CHARACTERS: Record<MonsterId, CharacterDef> = {
  abysnaga,
  drumjaw,
  ignisphere,
}

export const CHARACTER_LIST: CharacterDef[] = [abysnaga, drumjaw, ignisphere]

export function getCharacter(id: MonsterId): CharacterDef {
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
