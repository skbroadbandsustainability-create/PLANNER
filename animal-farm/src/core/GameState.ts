import {
  BASE_PEN_CAPACITY,
  BASE_ROPE_COUNT,
  MAX_SPARE_ROPES,
  QUESTS,
  ROPE_TIERS,
  SKILLS_BY_ID,
  SPARE_ROPE_RECIPE,
  SPECIES_BY_ID,
  xpToNextLevel,
} from './data.ts'
import type { InventoryState, ItemId, QuestDef, RopeTierDef, SkillId } from './types.ts'

export interface DeliverResult {
  droppedItem: ItemId | null
  completedQuests: QuestDef[]
  leveledUp: boolean
  newLevel: number
}

/** 게임 전체 진행 상태를 담는 중앙 저장소. UI/월드가 이 값을 읽고 갱신한다. */
export class GameState {
  readonly playerName = '민주호'

  level = 1
  xp = 0
  skillPoints = 0
  inventory: InventoryState = { feed: 2 }
  unlockedSkills = new Set<SkillId>()
  ropeTierId = 0
  spareRopes = 0

  /** 종별 누적 구조 마리 수 (퀘스트 진행도 계산용) */
  deliveredCounts: Record<string, number> = {}
  /** 종별 현재 농장에 있는 마리 수 */
  penCounts: Record<string, number> = {}
  claimedQuestIds = new Set<string>()

  get xpToNext(): number {
    return xpToNextLevel(this.level)
  }

  get ropeTier(): RopeTierDef {
    return ROPE_TIERS[this.ropeTierId] ?? ROPE_TIERS[0]
  }

  get penCapacity(): number {
    return BASE_PEN_CAPACITY + (this.unlockedSkills.has('penExpansion') ? 12 : 0)
  }

  get maxRopes(): number {
    return BASE_ROPE_COUNT + this.spareRopes + (this.unlockedSkills.has('multiLasso') ? 1 : 0)
  }

  canCraftSpareRope(): boolean {
    return this.spareRopes < MAX_SPARE_ROPES && this.canAfford(SPARE_ROPE_RECIPE)
  }

  /** 재료를 소모해 동시에 사용할 수 있는 밧줄 개수를 1개 늘린다 */
  craftSpareRope(): boolean {
    if (!this.canCraftSpareRope()) return false
    this.spend(SPARE_ROPE_RECIPE)
    this.spareRopes += 1
    return true
  }

  get penTotal(): number {
    return Object.values(this.penCounts).reduce((a, b) => a + b, 0)
  }

  get moveSpeedMultiplier(): number {
    return this.unlockedSkills.has('legwork') ? 1.15 : 1
  }

  get dragSpeedMultiplier(): number {
    return this.unlockedSkills.has('animalBond') ? 1.2 : 1
  }

  get ropeRangeBonus(): number {
    return this.unlockedSkills.has('lassoMastery') ? 1 : 0
  }

  addItem(item: ItemId, amount: number): void {
    this.inventory[item] = (this.inventory[item] ?? 0) + amount
  }

  canAfford(recipe: Partial<Record<ItemId, number>>): boolean {
    return Object.entries(recipe).every(
      ([item, need]) => (this.inventory[item as ItemId] ?? 0) >= (need ?? 0),
    )
  }

  private spend(recipe: Partial<Record<ItemId, number>>): void {
    for (const [item, need] of Object.entries(recipe)) {
      this.inventory[item as ItemId] = (this.inventory[item as ItemId] ?? 0) - (need ?? 0)
    }
  }

  /** NPC 상점에서 give 항목을 내고 get 항목을 받는 물물교환 */
  trade(give: Partial<Record<ItemId, number>>, get: Partial<Record<ItemId, number>>): boolean {
    if (!this.canAfford(give)) return false
    this.spend(give)
    for (const [item, amount] of Object.entries(get)) {
      this.addItem(item as ItemId, amount ?? 0)
    }
    return true
  }

  craftRope(tierId: number): boolean {
    const tier = ROPE_TIERS[tierId]
    if (!tier || !tier.recipe) return false
    if (tierId !== this.ropeTierId + 1) return false
    if (!this.canAfford(tier.recipe)) return false
    this.spend(tier.recipe)
    this.ropeTierId = tierId
    return true
  }

  canUnlockSkill(id: SkillId): boolean {
    if (this.unlockedSkills.has(id)) return false
    const def = SKILLS_BY_ID[id]
    if (!def) return false
    if (this.skillPoints < def.cost) return false
    return def.requires.every((r) => this.unlockedSkills.has(r))
  }

  unlockSkill(id: SkillId): boolean {
    if (!this.canUnlockSkill(id)) return false
    const def = SKILLS_BY_ID[id]
    this.skillPoints -= def.cost
    this.unlockedSkills.add(id)
    return true
  }

  /** 경험치를 지급하고 필요한 만큼 레벨업을 처리한다. */
  gainXp(amount: number): { leveledUp: boolean; newLevel: number } {
    this.xp += amount
    let leveledUp = false
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level += 1
      this.skillPoints += 1
      leveledUp = true
    }
    return { leveledUp, newLevel: this.level }
  }

  /** 동물을 농장 우리에 성공적으로 데려왔을 때 호출 */
  deliverAnimal(speciesId: string): DeliverResult {
    const species = SPECIES_BY_ID[speciesId]
    this.penCounts[speciesId] = (this.penCounts[speciesId] ?? 0) + 1
    this.deliveredCounts[speciesId] = (this.deliveredCounts[speciesId] ?? 0) + 1

    const xpResult = this.gainXp(15)

    let droppedItem: ItemId | null = null
    if (species && Math.random() < 0.6) {
      droppedItem = species.dropItem
      this.addItem(species.dropItem, 1)
    }

    const completedQuests: QuestDef[] = []
    for (const q of QUESTS) {
      if (q.speciesId !== speciesId) continue
      if (this.claimedQuestIds.has(q.id)) continue
      if ((this.deliveredCounts[speciesId] ?? 0) >= q.target) {
        this.claimedQuestIds.add(q.id)
        this.addItem(q.rewardItem, q.rewardItemAmount)
        this.gainXp(q.rewardXp)
        completedQuests.push(q)
      }
    }

    return { droppedItem, completedQuests, leveledUp: xpResult.leveledUp, newLevel: xpResult.newLevel }
  }

  questProgress(q: QuestDef): number {
    return Math.min(this.deliveredCounts[q.speciesId] ?? 0, q.target)
  }
}
