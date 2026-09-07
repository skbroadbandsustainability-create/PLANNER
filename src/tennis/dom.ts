// DOM 오버레이(메뉴/상점/HUD 등) 빌드 & 동기화. 3D 캔버스는 scene3d.ts가 담당하고
// 이 모듈은 그 위에 얹히는 HTML UI만 다룬다.

import { CHARACTER_LIST, getCharacter, skillCooldownAtLevel, skillDamageAtLevel } from './characters.ts'
import {
  characterLevelUpCost,
  loadSave,
  MAX_CHARACTER_LEVEL,
  skillUpgradeCost,
} from './save.ts'
import type { Character } from './entities.ts'
import type { GameStateName, MonsterId } from './types.ts'

export interface ScreenSyncState {
  screen: GameStateName
  selectedId: MonsterId
  shopCharId: MonsterId
}

export interface HudSyncState {
  player: Character
  ai: Character
  score: { player: number; ai: number }
  pointBanner: string
  pointBannerTimer: number
  matchWon: boolean
  matchMoneyEarned: number
}

const MATCH_SCREENS: GameStateName[] = ['playing', 'pointResult', 'matchResult', 'paused']

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found) throw new Error(`DOM 요소를 찾을 수 없습니다: #${id}`)
  return found as T
}

export class DomUI {
  private screens: Record<string, HTMLElement>
  private menuMoney = el<HTMLElement>('menu-money')
  private shopMoney = el<HTMLElement>('shop-money')
  private selectCards = el<HTMLElement>('select-cards')
  private shopTabs = el<HTMLElement>('shop-tabs')
  private shopDetail = el<HTMLElement>('shop-detail')
  private hud = el<HTMLElement>('hud')
  private scoreText = el<HTMLElement>('score-text')
  private pointBannerEl = el<HTMLElement>('point-banner')
  private resultTitle = el<HTMLElement>('result-title')
  private resultScore = el<HTMLElement>('result-score')
  private resultMoney = el<HTMLElement>('result-money')

  private panels: Record<'player' | 'ai', { name: HTMLElement; hpFill: HTMLElement; hpText: HTMLElement; megaFill: HTMLElement; stun: HTMLElement }>
  private skillButtons: Record<'skill1' | 'skill2' | 'mega', { root: HTMLElement; name: HTMLElement; cdFill: HTMLElement; level: HTMLElement }>

  private lastScreenKey = ''
  private dispatch: (action: string) => void

  constructor(dispatch: (action: string) => void) {
    this.dispatch = dispatch
    this.screens = {
      menu: el('screen-menu'),
      howto: el('screen-howto'),
      select: el('screen-select'),
      shop: el('screen-shop'),
      paused: el('screen-paused'),
      matchResult: el('screen-matchResult'),
    }

    this.panels = {
      player: {
        name: el('panel-player-name'),
        hpFill: el('panel-player-hp-fill'),
        hpText: el('panel-player-hp-text'),
        megaFill: el('panel-player-mega-fill'),
        stun: el('panel-player-stun'),
      },
      ai: {
        name: el('panel-ai-name'),
        hpFill: el('panel-ai-hp-fill'),
        hpText: el('panel-ai-hp-text'),
        megaFill: el('panel-ai-mega-fill'),
        stun: el('panel-ai-stun'),
      },
    }

    this.skillButtons = {
      skill1: { root: el('btn-skill1'), name: el('skill1-name'), cdFill: el('skill1-cd-fill'), level: el('skill1-level') },
      skill2: { root: el('btn-skill2'), name: el('skill2-name'), cdFill: el('skill2-cd-fill'), level: el('skill2-level') },
      mega: { root: el('btn-mega'), name: el('mega-name'), cdFill: el('mega-cd-fill'), level: el('mega-level') },
    }

    document.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const actionEl = target.closest<HTMLElement>('[data-action]')
      if (actionEl?.dataset.action) this.dispatch(actionEl.dataset.action)
    })
  }

  /** 화면 전환 + 메뉴/선택/상점처럼 자주 바뀌지 않는 화면들을 동기화한다. */
  syncScreens(state: ScreenSyncState): void {
    const save = loadSave()
    const key = `${state.screen}|${state.selectedId}|${state.shopCharId}|${save.money}|${JSON.stringify(save.characters)}`
    if (key === this.lastScreenKey) {
      this.applyVisibility(state.screen)
      return
    }
    this.lastScreenKey = key

    this.menuMoney.textContent = String(save.money)
    this.shopMoney.textContent = String(save.money)

    this.renderSelectCards(state.selectedId)
    this.renderShop(state.shopCharId)
    this.applyVisibility(state.screen)
  }

  private applyVisibility(screen: GameStateName): void {
    for (const [key, node] of Object.entries(this.screens)) {
      node.hidden = key !== screen
    }
    this.hud.hidden = !MATCH_SCREENS.includes(screen)
  }

  private renderSelectCards(selectedId: MonsterId): void {
    const save = loadSave()
    this.selectCards.innerHTML = CHARACTER_LIST.map((def) => {
      const progress = save.characters[def.id]
      const selected = def.id === selectedId
      const skillsHtml = def.skills
        .map((s) => {
          const lvl = progress.skillLevels[s.id] ?? 0
          return `<li class="${lvl > 0 ? 'unlocked' : 'locked'}">${s.name}${lvl > 0 ? ` Lv${lvl}` : ' (미해금)'}</li>`
        })
        .join('')
      return `
        <div class="char-card ${selected ? 'selected' : ''}" data-action="pick-${def.id}" style="--accent:${def.accentColor}">
          <div class="char-badge" style="background:${def.color}; box-shadow: 0 0 22px ${def.accentColor}66;"></div>
          <h3>${def.name}</h3>
          <p class="type-label">${def.typeLabel}</p>
          <p class="char-level">Lv.${progress.level}</p>
          <ul class="skill-list">${skillsHtml}</ul>
          <p class="char-desc">${def.description}</p>
          <button class="pick-btn" data-action="pick-${def.id}">${selected ? '선택됨' : '선택하기'}</button>
        </div>`
    }).join('')
  }

  private renderShop(shopCharId: MonsterId): void {
    const save = loadSave()
    this.shopTabs.innerHTML = CHARACTER_LIST.map((def) => {
      const active = def.id === shopCharId
      return `<button class="tab-btn ${active ? 'active' : ''}" data-action="shop-tab-${def.id}">${def.name}</button>`
    }).join('')

    const def = getCharacter(shopCharId)
    const progress = save.characters[def.id]
    const lvCost = characterLevelUpCost(progress.level)
    const maxedChar = progress.level >= MAX_CHARACTER_LEVEL
    const canLevelUp = !maxedChar && save.money >= lvCost

    const skillsHtml = def.skills
      .map((skill, idx) => {
        const level = progress.skillLevels[skill.id] ?? 0
        const cost = skillUpgradeCost(skill.baseCost, skill.costGrowth, level)
        const maxed = level >= skill.maxLevel
        const canBuy = !maxed && save.money >= cost
        const dmg = Math.round(skillDamageAtLevel(skill, Math.max(level, 1)))
        const cd = skillCooldownAtLevel(skill, Math.max(level, 1)).toFixed(1)
        const label = maxed ? '최대 레벨' : level === 0 ? `해금 (${cost}💰)` : `강화 (${cost}💰)`
        return `
          <div class="shop-skill" style="--skill-color:${skill.color}">
            <div class="shop-skill-info">
              <h4>${skill.name} <span class="lv">Lv ${level}/${skill.maxLevel}</span></h4>
              <p>${skill.description}</p>
              <p class="stat-line">데미지 ${dmg} · 쿨타임 ${cd}s</p>
            </div>
            <button class="buy-btn" data-action="levelup-skill${idx + 1}" ${canBuy ? '' : 'disabled'}>${label}</button>
          </div>`
      })
      .join('')

    this.shopDetail.innerHTML = `
      <div class="shop-header">
        <h3>${def.name} <span class="type-label">(${def.typeLabel})</span></h3>
        <p>캐릭터 레벨 ${progress.level} / ${MAX_CHARACTER_LEVEL} · 최대 체력 ${Math.round(def.baseHp + (progress.level - 1) * 6)}</p>
        <button class="buy-btn levelup" data-action="levelup-char" ${canLevelUp ? '' : 'disabled'}>${
          maxedChar ? '레벨 최대' : `레벨업 (${lvCost}💰)`
        }</button>
      </div>
      <div class="shop-skills">${skillsHtml}</div>
    `
  }

  /** 경기 중 프레임마다 갱신되는 HUD (체력/게이지/쿨타임/스코어). */
  syncHud(state: HudSyncState): void {
    this.syncPanel('player', state.player)
    this.syncPanel('ai', state.ai)
    this.scoreText.textContent = `${state.score.player} : ${state.score.ai}`

    const p = state.player
    const [s1, s2] = p.def.skills
    this.syncSkillButton('skill1', s1.name, p.skillLevels[s1.id] ?? 0, p.cooldowns[s1.id] ?? 0, skillCooldownAtLevel(s1, p.skillLevels[s1.id] ?? 0))
    this.syncSkillButton('skill2', s2.name, p.skillLevels[s2.id] ?? 0, p.cooldowns[s2.id] ?? 0, skillCooldownAtLevel(s2, p.skillLevels[s2.id] ?? 0))
    const megaReady = p.megaGauge >= 100 && !p.isMega
    this.skillButtons.mega.name.textContent = p.isMega ? '메가진화중' : '메가진화'
    this.skillButtons.mega.level.textContent = ''
    this.skillButtons.mega.cdFill.style.height = `${p.isMega ? 0 : 100 - p.megaGauge}%`
    this.skillButtons.mega.root.classList.toggle('ready', megaReady)
    this.skillButtons.mega.root.classList.toggle('locked', false)

    if (state.pointBannerTimer > 0 && state.pointBanner) {
      this.pointBannerEl.hidden = false
      this.pointBannerEl.textContent = state.pointBanner
      this.pointBannerEl.style.opacity = String(Math.min(1, state.pointBannerTimer / 0.3))
    } else {
      this.pointBannerEl.hidden = true
    }

    this.resultTitle.textContent = state.matchWon ? '승리!' : '패배...'
    this.resultTitle.classList.toggle('won', state.matchWon)
    this.resultScore.textContent = `최종 스코어  ${state.score.player} : ${state.score.ai}`
    this.resultMoney.textContent = `+${state.matchMoneyEarned} 💰 획득!`
  }

  private syncPanel(key: 'player' | 'ai', c: Character): void {
    const panel = this.panels[key]
    panel.name.textContent = c.isMega ? `${c.def.name} ⭐메가` : c.def.name
    const ratio = Math.max(0, c.hp / c.maxHp)
    panel.hpFill.style.width = `${ratio * 100}%`
    panel.hpFill.classList.toggle('low', ratio <= 0.3)
    panel.hpText.textContent = `${Math.round(c.hp)} / ${c.maxHp}`
    panel.megaFill.style.width = `${c.megaGauge}%`
    if (c.isStunned()) {
      panel.stun.hidden = false
      panel.stun.textContent = `기절! ${c.stunTimer.toFixed(1)}s`
    } else {
      panel.stun.hidden = true
    }
  }

  private syncSkillButton(key: 'skill1' | 'skill2', name: string, level: number, cooldown: number, maxCooldown: number): void {
    const btn = this.skillButtons[key]
    btn.name.textContent = name
    btn.level.textContent = level > 0 ? `Lv${level}` : '미해금'
    const ratio = level > 0 && Number.isFinite(maxCooldown) && maxCooldown > 0 ? cooldown / maxCooldown : 0
    btn.cdFill.style.height = `${Math.max(0, Math.min(1, ratio)) * 100}%`
    btn.root.classList.toggle('locked', level <= 0)
    btn.root.classList.toggle('ready', level > 0 && cooldown <= 0)
  }
}
