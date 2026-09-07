import { CHARACTER_LIST } from './characters.ts'
import type { MonsterId } from './types.ts'

const STORAGE_KEY = 'monster-tennis-save-v1'

export interface CharacterProgress {
  level: number
  skillLevels: Record<string, number>
}

export interface SaveData {
  money: number
  characters: Record<MonsterId, CharacterProgress>
}

function freshCharacterProgress(): CharacterProgress {
  return { level: 1, skillLevels: {} }
}

function freshSave(): SaveData {
  const characters = {} as Record<MonsterId, CharacterProgress>
  for (const c of CHARACTER_LIST) {
    const skillLevels: Record<string, number> = {}
    // 각 캐릭터의 첫 번째 스킬은 기본적으로 1레벨로 시작한다.
    skillLevels[c.skills[0].id] = 1
    characters[c.id] = { level: 1, skillLevels }
  }
  return { money: 80, characters }
}

let cache: SaveData | null = null

export function loadSave(): SaveData {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SaveData
      // 새 캐릭터가 추가된 경우 대비하여 누락된 항목을 보강한다.
      for (const c of CHARACTER_LIST) {
        if (!parsed.characters[c.id]) {
          parsed.characters[c.id] = freshCharacterProgress()
        }
      }
      cache = parsed
      return parsed
    }
  } catch {
    // 저장 데이터가 손상된 경우 새로 시작한다.
  }
  cache = freshSave()
  return cache
}

export function persistSave(): void {
  if (!cache) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 저장 실패(예: 프라이빗 모드)는 조용히 무시한다.
  }
}

export function addMoney(amount: number): void {
  const save = loadSave()
  save.money = Math.max(0, save.money + amount)
  persistSave()
}

export function getSkillLevel(charId: MonsterId, skillId: string): number {
  const save = loadSave()
  return save.characters[charId]?.skillLevels[skillId] ?? 0
}

export function getCharacterLevel(charId: MonsterId): number {
  const save = loadSave()
  return save.characters[charId]?.level ?? 1
}

export function skillUpgradeCost(baseCost: number, growth: number, currentLevel: number): number {
  // currentLevel 0 -> 1레벨 해금 비용, 이후 레벨마다 growth배씩 증가
  return Math.round(baseCost * Math.pow(growth, currentLevel))
}

export function characterLevelUpCost(currentLevel: number): number {
  return Math.round(30 * Math.pow(1.5, currentLevel - 1))
}

export function trySkillUpgrade(
  charId: MonsterId,
  skillId: string,
  baseCost: number,
  growth: number,
  maxLevel: number,
): boolean {
  const save = loadSave()
  const progress = save.characters[charId]
  const current = progress.skillLevels[skillId] ?? 0
  if (current >= maxLevel) return false
  const cost = skillUpgradeCost(baseCost, growth, current)
  if (save.money < cost) return false
  save.money -= cost
  progress.skillLevels[skillId] = current + 1
  persistSave()
  return true
}

const MAX_CHARACTER_LEVEL = 10

export function tryCharacterLevelUp(charId: MonsterId): boolean {
  const save = loadSave()
  const progress = save.characters[charId]
  if (progress.level >= MAX_CHARACTER_LEVEL) return false
  const cost = characterLevelUpCost(progress.level)
  if (save.money < cost) return false
  save.money -= cost
  progress.level += 1
  persistSave()
  return true
}

export { MAX_CHARACTER_LEVEL }
