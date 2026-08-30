import {
  ITEM_EMOJI,
  ITEM_NAMES,
  QUESTS,
  ROPE_TIERS,
  SHOP_OFFERS,
  SKILLS,
  SPECIES,
} from '../core/data.ts'
import { GameState } from '../core/GameState.ts'
import type { ItemId, SkillId } from '../core/types.ts'

type PanelName = 'inventory' | 'skills' | 'quests' | 'shop' | null
type InventoryTab = 'items' | 'craft'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (text !== undefined) e.textContent = text
  return e
}

function fmtRecipe(recipe: Partial<Record<ItemId, number>>): string {
  return Object.entries(recipe)
    .map(([item, n]) => `${ITEM_NAMES[item] ?? item} ${n}`)
    .join(', ')
}

/** 게임의 모든 DOM UI(HUD, 인벤토리, 스킬트리, 퀘스트로그, 상점, 토스트)를 관리한다. */
export class UI {
  private hudLevel: HTMLElement
  private hudName: HTMLElement
  private xpFill: HTMLElement
  private hudXpText: HTMLElement
  private hudSkillPoints: HTMLElement
  private ropeTierText: HTMLElement
  private ropeRangeText: HTMLElement
  private ropeCountText: HTMLElement
  private promptBanner: HTMLElement
  private toastStack: HTMLElement
  private backdrop: HTMLElement
  private panelCard: HTMLElement
  private questBadge: HTMLElement

  private currentPanel: PanelName = null
  private inventoryTab: InventoryTab = 'items'

  constructor(
    container: HTMLElement,
    private state: GameState,
  ) {
    const hud = el('div', 'hud-layer')

    // 플레이어 정보
    const hudPlayer = el('div', 'hud-player')
    const nameRow = el('div', 'name-row')
    this.hudName = el('span', undefined, state.playerName)
    this.hudLevel = el('span', 'level-badge', `Lv.1`)
    nameRow.append(this.hudName, this.hudLevel)
    const xpTrack = el('div', 'xp-bar-track')
    this.xpFill = el('div', 'xp-bar-fill')
    xpTrack.append(this.xpFill)
    const sub = el('div', 'hud-sub')
    this.hudXpText = el('span')
    this.hudSkillPoints = el('span')
    sub.append(this.hudXpText, this.hudSkillPoints)
    hudPlayer.append(nameRow, xpTrack, sub)
    hud.append(hudPlayer)

    // 밧줄 상태
    const hudRope = el('div', 'hud-rope')
    const ropeTitle = el('div', 'rope-title', '🪢 밧줄')
    this.ropeTierText = el('div')
    this.ropeRangeText = el('div')
    this.ropeCountText = el('div')
    hudRope.append(ropeTitle, this.ropeTierText, this.ropeRangeText, this.ropeCountText)
    hud.append(hudRope)

    // 조준점
    hud.append(el('div', 'crosshair'))

    // 프롬프트
    this.promptBanner = el('div', 'prompt-banner')
    hud.append(this.promptBanner)

    // 토스트
    this.toastStack = el('div', 'toast-stack')
    hud.append(this.toastStack)

    // 하단 버튼바
    const bottomBar = el('div', 'bottom-bar')
    bottomBar.append(this.makeHudButton('🎒', '인벤토리', () => this.togglePanel('inventory')))
    const questBtnWrap = this.makeHudButton('📜', '퀘스트', () => this.togglePanel('quests'))
    this.questBadge = el('span', 'badge')
    this.questBadge.hidden = true
    questBtnWrap.append(this.questBadge)
    bottomBar.append(questBtnWrap)
    bottomBar.append(this.makeHudButton('🌟', '스킬', () => this.togglePanel('skills')))
    hud.append(bottomBar)

    // 패널
    this.backdrop = el('div', 'panel-backdrop')
    this.backdrop.hidden = true
    this.panelCard = el('div', 'panel-card')
    this.backdrop.append(this.panelCard)
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.closePanel()
    })
    hud.append(this.backdrop)

    container.append(hud)

    this.refreshHUD()
  }

  private makeHudButton(icon: string, label: string, onClick: () => void): HTMLElement {
    const wrap = el('div', 'hud-btn-wrap')
    const btn = el('button', 'hud-btn')
    btn.append(el('span', 'icon', icon), el('span', undefined, label))
    btn.addEventListener('click', onClick)
    wrap.append(btn)
    return wrap
  }

  // ------------------------------------------------------------------
  // HUD 갱신
  // ------------------------------------------------------------------
  refreshHUD(): void {
    const s = this.state
    this.hudLevel.textContent = `Lv.${s.level}`
    this.hudName.textContent = s.playerName
    const pct = Math.min(100, (s.xp / s.xpToNext) * 100)
    this.xpFill.style.width = `${pct}%`
    this.hudXpText.textContent = `XP ${s.xp}/${s.xpToNext}`
    this.hudSkillPoints.textContent = `스킬P ${s.skillPoints}`

    this.ropeTierText.textContent = s.ropeTier.name
    this.ropeRangeText.textContent = `사거리 ${(s.ropeTier.range + s.ropeRangeBonus).toFixed(1)}m`

    const unclaimed = QUESTS.filter((q) => !s.claimedQuestIds.has(q.id) && s.questProgress(q) >= q.target).length
    this.questBadge.hidden = unclaimed === 0
    this.questBadge.textContent = String(unclaimed)
  }

  updateRopeCount(active: number): void {
    this.ropeCountText.textContent = `사용중 ${active}/${this.state.maxRopes}`
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.promptBanner.classList.remove('visible')
      return
    }
    this.promptBanner.textContent = text
    this.promptBanner.classList.add('visible')
  }

  showToast(text: string, kind: 'info' | 'success' | 'warning' | 'levelup' = 'info'): void {
    const t = el('div', `toast ${kind}`, text)
    this.toastStack.append(t)
    setTimeout(() => t.remove(), 2900)
  }

  get isPanelOpen(): boolean {
    return this.currentPanel !== null
  }

  // ------------------------------------------------------------------
  // 패널 전환
  // ------------------------------------------------------------------
  togglePanel(name: Exclude<PanelName, null>): void {
    if (this.currentPanel === name) {
      this.closePanel()
    } else {
      this.openPanel(name)
    }
  }

  openPanel(name: Exclude<PanelName, null>): void {
    this.currentPanel = name
    this.backdrop.hidden = false
    this.renderPanel()
  }

  closePanel(): void {
    this.currentPanel = null
    this.backdrop.hidden = true
  }

  openShop(): void {
    this.openPanel('shop')
  }

  private renderPanel(): void {
    this.panelCard.replaceChildren()
    if (this.currentPanel === 'inventory') this.renderInventory()
    else if (this.currentPanel === 'skills') this.renderSkills()
    else if (this.currentPanel === 'quests') this.renderQuests()
    else if (this.currentPanel === 'shop') this.renderShop()
  }

  private renderHeader(title: string): void {
    const header = el('div', 'panel-header')
    header.append(el('h2', undefined, title))
    const closeBtn = el('button', 'panel-close', '✕')
    closeBtn.addEventListener('click', () => this.closePanel())
    header.append(closeBtn)
    this.panelCard.append(header)
  }

  private renderInventory(): void {
    this.renderHeader('🎒 인벤토리')

    const tabs = el('div', 'panel-tabs')
    const itemsTab = el('button', `panel-tab${this.inventoryTab === 'items' ? ' active' : ''}`, '아이템')
    const craftTab = el('button', `panel-tab${this.inventoryTab === 'craft' ? ' active' : ''}`, '제작')
    itemsTab.addEventListener('click', () => {
      this.inventoryTab = 'items'
      this.renderPanel()
    })
    craftTab.addEventListener('click', () => {
      this.inventoryTab = 'craft'
      this.renderPanel()
    })
    tabs.append(itemsTab, craftTab)
    this.panelCard.append(tabs)

    if (this.inventoryTab === 'items') {
      const grid = el('div', 'item-grid')
      for (const item of Object.keys(ITEM_NAMES) as ItemId[]) {
        const count = this.state.inventory[item] ?? 0
        const cell = el('div', 'item-cell')
        cell.append(
          el('div', 'emoji', ITEM_EMOJI[item] ?? '❔'),
          el('div', 'name', ITEM_NAMES[item]),
          el('div', 'count', String(count)),
        )
        grid.append(cell)
      }
      this.panelCard.append(grid)
    } else {
      const currentTier = ROPE_TIERS[this.state.ropeTierId]!
      const infoRow = el('div', 'recipe-row')
      infoRow.append(el('div', 'info', `현재 장비: ${currentTier.name}`))
      this.panelCard.append(infoRow)

      const nextTier = ROPE_TIERS[this.state.ropeTierId + 1]
      if (!nextTier || !nextTier.recipe) {
        this.panelCard.append(el('div', 'recipe-row', '이미 최고 등급 밧줄이에요!'))
      } else {
        const row = el('div', 'recipe-row')
        const info = el('div', 'info')
        info.append(
          el('div', undefined, `${nextTier.name} (사거리 ${nextTier.range}m)`),
          el('div', 'cost', `필요: ${fmtRecipe(nextTier.recipe)}`),
        )
        const canAfford = this.state.canAfford(nextTier.recipe)
        const btn = el('button', 'action-btn', '제작하기')
        btn.disabled = !canAfford
        btn.addEventListener('click', () => {
          if (this.state.craftRope(nextTier.id)) {
            this.showToast(`${nextTier.name} 제작 완료!`, 'success')
            this.refreshHUD()
            this.renderPanel()
          }
        })
        row.append(info, btn)
        this.panelCard.append(row)
      }
    }
  }

  private renderSkills(): void {
    this.renderHeader(`🌟 스킬 트리 (포인트 ${this.state.skillPoints})`)
    for (const skill of SKILLS) {
      const unlocked = this.state.unlockedSkills.has(skill.id)
      const canUnlock = this.state.canUnlockSkill(skill.id)
      const locked = !unlocked && !canUnlock
      const row = el('div', `skill-row${unlocked ? ' unlocked' : locked ? ' locked' : ''}`)
      const info = el('div', 'info')
      const reqText = skill.requires.length
        ? ` (선행: ${skill.requires.map((r) => SKILLS.find((s) => s.id === r)?.name).join(', ')})`
        : ''
      info.append(
        el('div', 'title', `${skill.name} · ${skill.cost}P`),
        el('div', 'desc', skill.desc + reqText),
      )
      const btn = el('button', 'action-btn', unlocked ? '습득함' : '습득')
      btn.disabled = unlocked || !canUnlock
      btn.addEventListener('click', () => {
        if (this.state.unlockSkill(skill.id as SkillId)) {
          this.showToast(`${skill.name} 습득!`, 'success')
          this.refreshHUD()
          this.renderPanel()
        }
      })
      row.append(info, btn)
      this.panelCard.append(row)
    }
  }

  private renderQuests(): void {
    this.renderHeader('📜 동물 구조 퀘스트')
    for (const species of SPECIES) {
      const group = el('div', 'quest-group')
      group.append(el('div', 'species-title', `${species.name} (${biomeLabel(species.biome)})`))
      for (const q of QUESTS.filter((q) => q.speciesId === species.id)) {
        const progress = this.state.questProgress(q)
        const done = this.state.claimedQuestIds.has(q.id)
        const row = el('div', `quest-item${done ? ' done' : ''}`)
        row.append(
          el('span', undefined, `${species.name} ${q.target}마리 구조 (${q.tier}단계)`),
          el(
            'span',
            undefined,
            done ? '✅ 완료' : `${progress}/${q.target} · 보상 XP ${q.rewardXp}`,
          ),
        )
        group.append(row)
      }
      this.panelCard.append(group)
    }
  }

  private renderShop(): void {
    this.renderHeader('🧑‍🌾 사료 가게 아저씨')
    this.panelCard.append(
      el('p', undefined, '"어서오게! 동물들이 좋아할 재료를 사료나 밧줄실로 바꿔줄 수 있어."'),
    )
    for (const offer of SHOP_OFFERS) {
      const row = el('div', 'recipe-row')
      const info = el('div', 'info')
      info.append(el('div', undefined, offer.label))
      const canAfford = this.state.canAfford(offer.give)
      const btn = el('button', 'action-btn', '교환')
      btn.disabled = !canAfford
      btn.addEventListener('click', () => {
        if (this.state.trade(offer.give, offer.get)) {
          this.showToast('교환 완료!', 'success')
          this.refreshHUD()
          this.renderPanel()
        }
      })
      row.append(info, btn)
      this.panelCard.append(row)
    }
  }
}

function biomeLabel(biome: string): string {
  switch (biome) {
    case 'grassland':
      return '초원'
    case 'coast':
      return '바다'
    case 'mountain':
      return '산'
    case 'river':
      return '강'
    default:
      return biome
  }
}
