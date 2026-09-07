import { CHARACTER_LIST, getCharacter, skillCooldownAtLevel, skillDamageAtLevel } from './characters.ts'
import {
  AI_MIN_Y,
  CANVAS_H,
  CANVAS_W,
  COURT_BOTTOM,
  COURT_LEFT,
  COURT_RIGHT,
  COURT_TOP,
  HIT_REACH,
  NET_Y,
  OUT_MARGIN,
  PLAYER_MAX_Y,
  POINTS_TO_WIN,
} from './constants.ts'
import { drawBall, drawCharacter, drawCourt, drawVignette } from './draw.ts'
import { Ball, Character } from './entities.ts'
import type { Side } from './entities.ts'
import { EffectSystem } from './effects.ts'
import { input } from './input.ts'
import {
  addMoney,
  characterLevelUpCost,
  loadSave,
  MAX_CHARACTER_LEVEL,
  skillUpgradeCost,
  tryCharacterLevelUp,
  trySkillUpgrade,
} from './save.ts'
import type { PokemonId, SkillDef, StatusEffect } from './types.ts'
import { drawBar, drawButton, drawCooldownButton, drawPanel, pointInButton } from './ui.ts'
import type { Button } from './ui.ts'

type Screen = 'menu' | 'select' | 'howto' | 'shop' | 'playing' | 'pointResult' | 'matchResult' | 'paused'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export class TennisGame {
  private ctx: CanvasRenderingContext2D
  private screen: Screen = 'menu'
  private effects = new EffectSystem()
  private time = 0

  private selectedId: PokemonId = 'greninja'
  private shopCharId: PokemonId = 'greninja'

  private player: Character | null = null
  private ai: Character | null = null
  private ball: Ball | null = null

  private score = { player: 0, ai: 0 }
  private server: Side = 'player'
  private rallyTimer = 0
  private pointBanner = ''
  private pointBannerTimer = 0

  private matchMoneyEarned = 0
  private matchWon = false

  private buttons: Button[] = []
  private mouse = { x: -1, y: -1 }

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }

  handlePointerMove(x: number, y: number): void {
    this.mouse.x = x
    this.mouse.y = y
  }

  handleClick(x: number, y: number): void {
    for (const b of this.buttons) {
      if (!b.disabled && pointInButton(x, y, b)) {
        this.dispatch(b.id)
        return
      }
    }
  }

  // ---------------------------------------------------------------------
  // 화면 전환 / 버튼 동작
  // ---------------------------------------------------------------------

  private dispatch(id: string): void {
    if (id.startsWith('pick-')) {
      this.selectedId = id.slice('pick-'.length) as PokemonId
      return
    }
    if (id.startsWith('shop-tab-')) {
      this.shopCharId = id.slice('shop-tab-'.length) as PokemonId
      return
    }
    switch (id) {
      case 'start-select':
        this.screen = 'select'
        break
      case 'open-shop':
        this.shopCharId = this.selectedId
        this.screen = 'shop'
        break
      case 'open-howto':
        this.screen = 'howto'
        break
      case 'back-to-menu':
        this.screen = 'menu'
        break
      case 'confirm-start':
        this.setupMatch(this.selectedId)
        break
      case 'levelup-char':
        tryCharacterLevelUp(this.shopCharId)
        break
      case 'levelup-skill1':
      case 'levelup-skill2': {
        const def = getCharacter(this.shopCharId)
        const skill = id === 'levelup-skill1' ? def.skills[0] : def.skills[1]
        trySkillUpgrade(this.shopCharId, skill.id, skill.baseCost, skill.costGrowth, skill.maxLevel)
        break
      }
      case 'rematch':
        this.setupMatch(this.selectedId)
        break
      case 'to-shop':
        this.shopCharId = this.selectedId
        this.screen = 'shop'
        break
      case 'to-menu':
        this.screen = 'menu'
        break
      case 'resume':
        this.screen = 'playing'
        break
      case 'forfeit':
        this.screen = 'menu'
        break
      default:
        break
    }
  }

  private setupMatch(playerId: PokemonId): void {
    const save = loadSave()
    const playerDef = getCharacter(playerId)
    const others = CHARACTER_LIST.filter((c) => c.id !== playerId)
    const aiDef = others[Math.floor(Math.random() * others.length)]

    const playerProgress = save.characters[playerId]
    const centerX = (COURT_LEFT + COURT_RIGHT) / 2

    this.player = new Character(
      playerDef,
      'player',
      centerX,
      PLAYER_MAX_Y - 40,
      playerProgress.level,
      playerProgress.skillLevels,
    )

    const aiSkillLevels: Record<string, number> = {}
    aiSkillLevels[aiDef.skills[0].id] = clamp(Math.ceil(playerProgress.level * 0.7), 1, aiDef.skills[0].maxLevel)
    if (playerProgress.level >= 3) {
      aiSkillLevels[aiDef.skills[1].id] = clamp(
        Math.ceil((playerProgress.level - 1) * 0.5),
        1,
        aiDef.skills[1].maxLevel,
      )
    }
    const aiLevel = clamp(Math.round(playerProgress.level * 0.9), 1, MAX_CHARACTER_LEVEL)
    this.ai = new Character(aiDef, 'ai', centerX, AI_MIN_Y + 40, aiLevel, aiSkillLevels)

    this.ball = new Ball(centerX, NET_Y)
    this.score = { player: 0, ai: 0 }
    this.effects.clear()
    this.server = Math.random() < 0.5 ? 'player' : 'ai'
    this.screen = 'playing'
    this.startRally(this.server)
  }

  // ---------------------------------------------------------------------
  // 갱신 루프
  // ---------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt
    if (this.screen === 'playing') {
      this.updatePlaying(dt)
    } else if (this.screen === 'pointResult') {
      this.updatePointResult(dt)
    }
    this.effects.update(dt)
    input.endFrame()
  }

  private updatePlaying(dt: number): void {
    const player = this.player
    const ai = this.ai
    const ball = this.ball
    if (!player || !ai || !ball) return

    player.update(dt)
    ai.update(dt)
    ball.update(dt)

    this.handlePlayerInput(player, ball, dt)
    this.updateAi(ai, ball, dt)
    this.checkAiMega(ai)
    this.checkOutOfBounds(ball)

    if (this.pointBannerTimer > 0) {
      this.pointBannerTimer = Math.max(0, this.pointBannerTimer - dt)
    }

    if (player.hp <= 0 && player.stunTimer <= 0) {
      // 안전장치: hp가 0인데 스턴이 걸리지 않은 경우 방지
      player.stunTimer = 5
    }
    if (ai.hp <= 0 && ai.stunTimer <= 0) {
      ai.stunTimer = 5
    }

    if (input.pausePressed) {
      this.screen = 'paused'
    }
  }

  private updatePointResult(dt: number): void {
    this.player?.update(dt)
    this.ai?.update(dt)
    if (this.pointBannerTimer > 0) this.pointBannerTimer = Math.max(0, this.pointBannerTimer - dt)
    this.rallyTimer -= dt
    if (this.rallyTimer <= 0) {
      this.screen = 'playing'
      this.startRally(this.server)
    }
  }

  private ballInReach(c: Character, ball: Ball): boolean {
    return Math.hypot(c.x - ball.x, c.y - ball.y) <= HIT_REACH
  }

  private isDefenderTurn(c: Character, ball: Ball): boolean {
    return ball.inPlay && ball.lastHitBy !== null && ball.lastHitBy !== c.side
  }

  private handlePlayerInput(player: Character, ball: Ball, dt: number): void {
    if (!player.isStunned()) {
      let mx = input.moveX
      let my = input.moveY
      if (player.isConfused) {
        mx = -mx
        my = -my
      }
      const len = Math.hypot(mx, my)
      if (len > 0) {
        mx /= len
        my /= len
        const b = player.moveBounds()
        player.x = clamp(player.x + mx * player.effectiveSpeed * dt, b.minX, b.maxX)
        player.y = clamp(player.y + my * player.effectiveSpeed * dt, b.minY, b.maxY)
      }

      if (this.isDefenderTurn(player, ball) && this.ballInReach(player, ball)) {
        const [s1, s2] = player.def.skills
        if (input.skill1Pressed && (player.skillLevels[s1.id] ?? 0) > 0 && player.cooldowns[s1.id] === 0) {
          this.performHit(player, s1)
        } else if (input.skill2Pressed && (player.skillLevels[s2.id] ?? 0) > 0 && player.cooldowns[s2.id] === 0) {
          this.performHit(player, s2)
        } else if (input.swingPressed) {
          this.performHit(player, null)
        }
      }

      if (input.megaPressed && !player.isMega && player.megaGauge >= 100) {
        this.triggerMega(player)
      }
    }
  }

  private updateAi(ai: Character, ball: Ball, dt: number): void {
    if (ai.isStunned()) return
    const b = ai.moveBounds()
    const centerY = (b.minY + b.maxY) / 2
    const centerX = (COURT_LEFT + COURT_RIGHT) / 2

    let targetX = ai.x
    let targetY = centerY
    if (ball.inPlay && ball.lastHitBy !== 'ai') {
      targetX = ball.x + Math.sin(this.time * 3.1) * 8
      targetY = clamp(ball.y, b.minY, b.maxY)
    } else {
      targetX = centerX
      targetY = centerY
    }

    const dx = targetX - ai.x
    const dy = targetY - ai.y
    const dist = Math.hypot(dx, dy)
    if (dist > 2) {
      const spd = ai.effectiveSpeed
      ai.x = clamp(ai.x + (dx / dist) * spd * dt, b.minX, b.maxX)
      ai.y = clamp(ai.y + (dy / dist) * spd * dt, b.minY, b.maxY)
    }

    if (this.isDefenderTurn(ai, ball) && this.ballInReach(ai, ball)) {
      this.aiAttemptHit(ai)
    }
  }

  private aiAttemptHit(ai: Character): void {
    const available = ai.def.skills.filter(
      (s) => (ai.skillLevels[s.id] ?? 0) > 0 && ai.cooldowns[s.id] === 0,
    )
    let chosen: SkillDef | null = null
    if (available.length > 0 && Math.random() < 0.5) {
      chosen = available[Math.floor(Math.random() * available.length)]
    }
    this.performHit(ai, chosen)
  }

  private checkAiMega(ai: Character): void {
    if (!ai.isMega && ai.megaGauge >= 100 && !ai.isStunned()) {
      this.triggerMega(ai)
    }
  }

  private triggerMega(c: Character): void {
    c.isMega = true
    c.megaGauge = 0
    this.effects.spawnHitImpact(c.x, c.y, c.def.megaColor)
    this.effects.spawnConfetti(c.x, c.y)
    this.effects.spawnScoreText(c.x, c.y - c.def.radius * 2.4, '메가진화!', c.def.megaColor)
  }

  private pickAimTarget(attackerSide: Side, fromX: number, defenderX: number): { x: number; y: number } {
    const centerX = (COURT_LEFT + COURT_RIGHT) / 2
    const targetY = attackerSide === 'player' ? COURT_TOP + 26 : COURT_BOTTOM - 26
    let targetX: number
    if (attackerSide === 'player') {
      targetX = centerX + (fromX - centerX) * 1.3 + (Math.random() - 0.5) * 50
    } else {
      if (Math.random() < 0.6) {
        const away = defenderX < centerX ? 1 : -1
        targetX = centerX + away * (130 + Math.random() * 190)
      } else {
        targetX = centerX + (Math.random() - 0.5) * 320
      }
    }
    targetX = clamp(targetX, COURT_LEFT + 30, COURT_RIGHT - 30)
    return { x: targetX, y: targetY }
  }

  private performHit(attacker: Character, skill: SkillDef | null): void {
    const ball = this.ball
    if (!ball) return
    const defender = attacker.side === 'player' ? this.ai : this.player
    attacker.swingAnim = 0.16

    const target = this.pickAimTarget(attacker.side, attacker.x, defender ? defender.x : attacker.x)
    let speed = 300
    let damage = 0
    let status: StatusEffect | undefined

    if (skill) {
      const level = attacker.skillLevels[skill.id] ?? 0
      damage = skillDamageAtLevel(skill, level)
      speed = 300 * 1.15
      attacker.cooldowns[skill.id] = skillCooldownAtLevel(skill, level)
      if (skill.status) {
        status = {
          kind: skill.status.kind,
          timeLeft: skill.status.duration,
          tickDamage: skill.status.tickDamage,
          tickInterval: skill.status.tickInterval,
          tickTimer: 0,
        }
      }
      this.effects.spawnSkillCast(attacker.x, attacker.y, skill.element, skill.color)
    }
    speed *= attacker.outgoingSpeedMultiplier

    const dx = target.x - attacker.x
    const dy = target.y - attacker.y
    const dist = Math.hypot(dx, dy) || 1
    ball.launch((dx / dist) * speed, (dy / dist) * speed, attacker.side)
    ball.isSkillShot = !!skill
    ball.skillElement = skill?.element ?? null
    ball.skillColor = skill?.color ?? '#fff59d'
    ball.skillDamage = damage
    ball.pendingStatus = status ?? null

    this.effects.spawnRacketHit(attacker.x, attacker.y, skill?.color ?? '#ffffff')

    if (!attacker.isMega) {
      attacker.megaGauge = Math.min(100, attacker.megaGauge + 12)
    }
  }

  private startRally(server: Side): void {
    const ball = this.ball
    const player = this.player
    const ai = this.ai
    if (!ball || !player || !ai) return

    this.pointBanner = ''
    const centerX = (COURT_LEFT + COURT_RIGHT) / 2
    const startX = clamp(centerX + (Math.random() - 0.5) * 100, COURT_LEFT + 40, COURT_RIGHT - 40)
    const startY = server === 'player' ? PLAYER_MAX_Y - 30 : AI_MIN_Y + 30
    ball.x = startX
    ball.y = startY
    ball.trail = []
    ball.clearSkill()

    const defenderX = server === 'player' ? ai.x : player.x
    const target = this.pickAimTarget(server, startX, defenderX)
    const speed = 210
    const dx = target.x - startX
    const dy = target.y - startY
    const dist = Math.hypot(dx, dy) || 1
    ball.launch((dx / dist) * speed, (dy / dist) * speed, server)
  }

  private checkOutOfBounds(ball: Ball): void {
    if (!ball.inPlay) return
    if (ball.y - ball.radius > COURT_BOTTOM + OUT_MARGIN && ball.lastHitBy === 'ai') {
      this.awardPoint('ai')
    } else if (ball.y + ball.radius < COURT_TOP - OUT_MARGIN && ball.lastHitBy === 'player') {
      this.awardPoint('player')
    }
  }

  private awardPoint(winner: Side): void {
    const ball = this.ball
    const player = this.player
    const ai = this.ai
    if (!ball || !player || !ai) return

    const loser: Side = winner === 'player' ? 'ai' : 'player'
    this.score[winner] += 1
    const loserChar = loser === 'player' ? player : ai

    let banner = winner === 'player' ? '득점!' : '상대 득점...'

    if (ball.isSkillShot && ball.skillDamage > 0) {
      loserChar.takeDamage(ball.skillDamage)
      this.effects.spawnHitImpact(loserChar.x, loserChar.y, ball.skillColor)
      this.effects.spawnDamageText(loserChar.x, loserChar.y - 40, ball.skillDamage)
      if (ball.pendingStatus) loserChar.applyStatus(ball.pendingStatus)
      if (loserChar.hp <= 0) {
        loserChar.stunTimer = 5
        banner = winner === 'player' ? '기절! 찬스다!' : '위험! 기절당함...'
      }
    }

    this.effects.spawnScoreText(
      (COURT_LEFT + COURT_RIGHT) / 2,
      winner === 'player' ? COURT_BOTTOM - 70 : COURT_TOP + 70,
      winner === 'player' ? 'PLAYER POINT!' : 'CPU POINT',
      winner === 'player' ? '#81e6ff' : '#ff8a80',
    )
    this.pointBanner = banner
    this.pointBannerTimer = 1.4
    ball.inPlay = false

    if (this.score.player >= POINTS_TO_WIN || this.score.ai >= POINTS_TO_WIN) {
      this.finishMatch(this.score.player >= POINTS_TO_WIN ? 'player' : 'ai')
    } else {
      this.server = this.server === 'player' ? 'ai' : 'player'
      this.rallyTimer = 1.3
      this.screen = 'pointResult'
    }
  }

  private finishMatch(winner: Side): void {
    const won = winner === 'player'
    const earned = won
      ? 80 + Math.round(Math.random() * 30) + this.score.player * 10
      : 20 + Math.round(Math.random() * 15)
    this.matchMoneyEarned = earned
    this.matchWon = won
    addMoney(earned)
    if (won) this.effects.spawnConfetti(CANVAS_W / 2, CANVAS_H / 2)
    this.screen = 'matchResult'
  }

  // ---------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------

  render(): void {
    const ctx = this.ctx
    this.buttons = []
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

    switch (this.screen) {
      case 'menu':
        this.renderMenu()
        break
      case 'select':
        this.renderSelect()
        break
      case 'howto':
        this.renderHowTo()
        break
      case 'shop':
        this.renderShop()
        break
      case 'playing':
      case 'pointResult':
        this.renderMatch()
        break
      case 'matchResult':
        this.renderMatch()
        this.renderMatchResultOverlay()
        break
      case 'paused':
        this.renderMatch()
        this.renderPauseOverlay()
        break
    }
  }

  private isHover(b: Button): boolean {
    return pointInButton(this.mouse.x, this.mouse.y, b)
  }

  private drawBg(): void {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
    g.addColorStop(0, '#1c1f3a')
    g.addColorStop(1, '#33356b')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  }

  private renderMenu(): void {
    const ctx = this.ctx
    this.drawBg()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 46px 'Jua', sans-serif"
    ctx.fillText('포켓몬 테니스 챔피언십', CANVAS_W / 2, 150)
    ctx.font = "18px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText('스킬로 상대를 흔들고, 메가진화로 승리를 거머쥐어라!', CANVAS_W / 2, 190)

    const save = loadSave()
    ctx.font = "16px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = '#ffe066'
    ctx.fillText(`💰 보유 금액: ${save.money}`, CANVAS_W / 2, 225)

    const btns: Button[] = [
      { id: 'start-select', x: CANVAS_W / 2 - 140, y: 280, w: 280, h: 60, label: '게임 시작' },
      { id: 'open-shop', x: CANVAS_W / 2 - 140, y: 355, w: 280, h: 60, label: '상점 / 스킬트리' },
      { id: 'open-howto', x: CANVAS_W / 2 - 140, y: 430, w: 280, h: 60, label: '조작법' },
    ]
    for (const b of btns) {
      drawButton(ctx, b, this.isHover(b))
      this.buttons.push(b)
    }

    ctx.font = "14px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText('이동: 방향키/WASD  ·  스매시: Space  ·  스킬: J / K  ·  메가진화: L', CANVAS_W / 2, 540)
  }

  private renderHowTo(): void {
    const ctx = this.ctx
    this.drawBg()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 32px 'Jua', sans-serif"
    ctx.fillText('조작법 & 규칙', CANVAS_W / 2, 90)

    drawPanel(this.ctx, 130, 130, CANVAS_W - 260, 380)
    ctx.textAlign = 'left'
    ctx.font = "17px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = '#ffffff'
    const lines = [
      '방향키 / WASD : 캐릭터 이동 (자기 진영 안에서만 이동)',
      'Space : 기본 스매시로 공 받아치기',
      'J : 스킬 1 사용 (공이 사거리 안에 있을 때)',
      'K : 스킬 2 사용 (공이 사거리 안에 있을 때)',
      'L : 메가진화 게이지가 가득 찼을 때 메가진화',
      'ESC : 일시정지',
      '',
      '· 공을 받아치면 메가진화 게이지가 조금씩 채워져요.',
      '· 스킬로 때린 공을 상대가 받아치지 못하면 체력이 줄어요.',
      '· 체력이 0이 되면 5초간 기절해서 그 사이 점수를 벌 수 있어요.',
      '· 코트 옆의 투명한 벽에 공이 맞으면 다시 튕겨 돌아와요.',
      `· 먼저 ${POINTS_TO_WIN}점을 내면 승리! 이기면 돈을 더 많이 받아요.`,
    ]
    let y = 165
    for (const line of lines) {
      ctx.fillText(line, 160, y)
      y += 28
    }

    const back: Button = { id: 'back-to-menu', x: CANVAS_W / 2 - 100, y: 540, w: 200, h: 50, label: '뒤로' }
    drawButton(ctx, back, this.isHover(back))
    this.buttons.push(back)
  }

  private renderSelect(): void {
    const ctx = this.ctx
    this.drawBg()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 32px 'Jua', sans-serif"
    ctx.fillText('포켓몬을 선택하세요', CANVAS_W / 2, 70)

    const save = loadSave()
    const cardW = 250
    const cardH = 400
    const gap = 30
    const totalW = cardW * 3 + gap * 2
    const startX = (CANVAS_W - totalW) / 2
    const cardY = 100

    CHARACTER_LIST.forEach((def, i) => {
      const x = startX + i * (cardW + gap)
      const selected = def.id === this.selectedId
      drawPanel(
        ctx,
        x,
        cardY,
        cardW,
        cardH,
        selected ? 'rgba(255,255,255,0.18)' : 'rgba(20,24,40,0.65)',
        selected ? '#ffe066' : 'rgba(255,255,255,0.18)',
      )

      ctx.save()
      ctx.translate(x + cardW / 2, cardY + 80)
      ctx.scale(1.4, 1.4)
      const preview = new Character(def, 'player', 0, 0, 1, {})
      drawCharacter(ctx, preview)
      ctx.restore()

      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.font = "bold 22px 'Jua', sans-serif"
      ctx.fillText(def.name, x + cardW / 2, cardY + 160)
      ctx.font = "14px 'Gowun Dodum', sans-serif"
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.fillText(def.typeLabel, x + cardW / 2, cardY + 182)

      const progress = save.characters[def.id]
      ctx.fillStyle = '#ffe066'
      ctx.fillText(`Lv.${progress.level}`, x + cardW / 2, cardY + 204)

      ctx.textAlign = 'left'
      ctx.font = "12px 'Gowun Dodum', sans-serif"
      def.skills.forEach((s, si) => {
        const lvl = progress.skillLevels[s.id] ?? 0
        ctx.fillStyle = lvl > 0 ? '#ffffff' : 'rgba(255,255,255,0.4)'
        const label = lvl > 0 ? `${s.name} Lv${lvl}` : `${s.name} (미해금)`
        ctx.fillText(label, x + 18, cardY + 232 + si * 20)
      })

      ctx.font = "12px 'Gowun Dodum', sans-serif"
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      wrapText(ctx, def.description, x + 18, cardY + 285, cardW - 36, 16)

      const pickBtn: Button = {
        id: `pick-${def.id}`,
        x: x + 20,
        y: cardY + cardH - 55,
        w: cardW - 40,
        h: 40,
        label: selected ? '선택됨' : '선택하기',
      }
      drawButton(ctx, pickBtn, this.isHover(pickBtn), selected ? '#ffe066' : '#8fd6ff')
      this.buttons.push(pickBtn)
    })

    const startBtn: Button = {
      id: 'confirm-start',
      x: CANVAS_W / 2 - 160,
      y: cardY + cardH + 30,
      w: 320,
      h: 55,
      label: '경기 시작!',
    }
    drawButton(ctx, startBtn, this.isHover(startBtn), '#8fe34f')
    this.buttons.push(startBtn)

    const back: Button = { id: 'back-to-menu', x: 40, y: 30, w: 100, h: 40, label: '뒤로' }
    drawButton(ctx, back, this.isHover(back))
    this.buttons.push(back)
  }

  private renderShop(): void {
    const ctx = this.ctx
    this.drawBg()
    const save = loadSave()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 30px 'Jua', sans-serif"
    ctx.fillText('상점 · 스킬트리', CANVAS_W / 2, 55)
    ctx.font = "18px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = '#ffe066'
    ctx.fillText(`💰 ${save.money}`, CANVAS_W / 2, 84)

    const tabW = 150
    const tabsX = CANVAS_W / 2 - (tabW * 3) / 2
    CHARACTER_LIST.forEach((def, i) => {
      const tab: Button = {
        id: `shop-tab-${def.id}`,
        x: tabsX + i * tabW,
        y: 105,
        w: tabW - 8,
        h: 42,
        label: def.name,
      }
      const active = this.shopCharId === def.id
      drawButton(ctx, tab, this.isHover(tab) || active, active ? '#ffe066' : '#8fd6ff')
      this.buttons.push(tab)
    })

    const def = getCharacter(this.shopCharId)
    const progress = save.characters[def.id]

    drawPanel(ctx, 100, 165, CANVAS_W - 200, 420)

    ctx.save()
    ctx.translate(170, 250)
    ctx.scale(1.5, 1.5)
    const preview = new Character(def, 'player', 0, 0, 1, {})
    drawCharacter(ctx, preview)
    ctx.restore()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = "bold 20px 'Jua', sans-serif"
    ctx.fillText(`${def.name} (${def.typeLabel})`, 240, 200)
    ctx.font = "14px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(`캐릭터 레벨 ${progress.level} / ${MAX_CHARACTER_LEVEL}`, 240, 225)
    ctx.fillText(`최대 체력 ${Math.round(def.baseHp + (progress.level - 1) * 6)}`, 240, 245)

    const lvCost = characterLevelUpCost(progress.level)
    const canLevelUp = progress.level < MAX_CHARACTER_LEVEL && save.money >= lvCost
    const lvBtn: Button = {
      id: 'levelup-char',
      x: 240,
      y: 260,
      w: 220,
      h: 46,
      label: progress.level >= MAX_CHARACTER_LEVEL ? '레벨 최대' : `레벨업 (${lvCost}💰)`,
      disabled: progress.level >= MAX_CHARACTER_LEVEL || !canLevelUp,
    }
    drawButton(ctx, lvBtn, this.isHover(lvBtn), '#8fe34f')
    this.buttons.push(lvBtn)

    let y = 330
    def.skills.forEach((skill, idx) => {
      const level = progress.skillLevels[skill.id] ?? 0
      const cost = skillUpgradeCost(skill.baseCost, skill.costGrowth, level)
      const maxed = level >= skill.maxLevel
      const canBuy = save.money >= cost && !maxed

      ctx.font = "bold 16px 'Jua', sans-serif"
      ctx.fillStyle = skill.color
      ctx.fillText(`${skill.name}  (Lv ${level}/${skill.maxLevel})`, 140, y)
      ctx.font = "12px 'Gowun Dodum', sans-serif"
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      wrapText(ctx, skill.description, 140, y + 20, 480, 15)
      ctx.fillText(
        `데미지 ${Math.round(skillDamageAtLevel(skill, Math.max(level, 1)))}  ·  쿨타임 ${skillCooldownAtLevel(skill, Math.max(level, 1)).toFixed(1)}s`,
        140,
        y + 55,
      )

      const btn: Button = {
        id: idx === 0 ? 'levelup-skill1' : 'levelup-skill2',
        x: 650,
        y: y - 22,
        w: 190,
        h: 46,
        label: maxed ? '최대 레벨' : level === 0 ? `해금 (${cost}💰)` : `강화 (${cost}💰)`,
        disabled: !canBuy,
      }
      drawButton(ctx, btn, this.isHover(btn), skill.color)
      this.buttons.push(btn)

      y += 90
    })

    const back: Button = { id: 'back-to-menu', x: 40, y: 30, w: 100, h: 40, label: '뒤로' }
    drawButton(ctx, back, this.isHover(back))
    this.buttons.push(back)
  }

  private renderMatch(): void {
    const ctx = this.ctx
    const player = this.player
    const ai = this.ai
    const ball = this.ball
    if (!player || !ai || !ball) return

    drawCourt(ctx, this.time)
    drawCharacter(ctx, ai)
    drawCharacter(ctx, player)
    drawBall(ctx, ball)
    this.effects.draw(ctx)
    drawVignette(ctx)

    this.renderHud(player, ai)

    if (this.pointBannerTimer > 0 && this.pointBanner) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, this.pointBannerTimer / 0.3)
      ctx.textAlign = 'center'
      ctx.font = "bold 34px 'Jua', sans-serif"
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 4
      ctx.strokeText(this.pointBanner, CANVAS_W / 2, CANVAS_H / 2 - 30)
      ctx.fillText(this.pointBanner, CANVAS_W / 2, CANVAS_H / 2 - 30)
      ctx.restore()
    }
  }

  private renderHud(player: Character, ai: Character): void {
    const ctx = this.ctx

    // 좌측 상단: 플레이어 정보
    this.renderSidePanel(20, 16, player, false)
    // 우측 상단: AI 정보
    this.renderSidePanel(CANVAS_W - 20 - 260, 16, ai, true)

    // 중앙 스코어
    ctx.textAlign = 'center'
    ctx.font = "bold 30px 'Jua', sans-serif"
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 3
    const scoreText = `${this.score.player} : ${this.score.ai}`
    ctx.strokeText(scoreText, CANVAS_W / 2, 45)
    ctx.fillText(scoreText, CANVAS_W / 2, 45)
    ctx.font = "12px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(`${POINTS_TO_WIN}점 선취 승리`, CANVAS_W / 2, 64)

    // 하단 스킬 버튼
    const [s1, s2] = player.def.skills
    const lvl1 = player.skillLevels[s1.id] ?? 0
    const lvl2 = player.skillLevels[s2.id] ?? 0
    const cdRatio1 = lvl1 > 0 ? player.cooldowns[s1.id] / Math.max(0.01, skillCooldownAtLevel(s1, lvl1)) : 0
    const cdRatio2 = lvl2 > 0 ? player.cooldowns[s2.id] / Math.max(0.01, skillCooldownAtLevel(s2, lvl2)) : 0

    const baseY = CANVAS_H - 90
    drawCooldownButton(ctx, CANVAS_W / 2 - 170, baseY, 60, cdRatio1, s1.color, 'J', s1.name, lvl1, cdRatio1 === 0)
    drawCooldownButton(ctx, CANVAS_W / 2 - 30, baseY, 60, cdRatio2, s2.color, 'K', s2.name, lvl2, cdRatio2 === 0)

    const megaReady = player.megaGauge >= 100 && !player.isMega
    drawCooldownButton(
      ctx,
      CANVAS_W / 2 + 110,
      baseY,
      60,
      player.isMega ? 0 : 1 - player.megaGauge / 100,
      player.def.megaColor,
      'L',
      player.isMega ? '메가진화중' : '메가진화',
      megaReady || player.isMega ? 1 : 0,
      megaReady,
    )
  }

  private renderSidePanel(x: number, y: number, c: Character, alignRight: boolean): void {
    const ctx = this.ctx
    const w = 260
    drawPanel(ctx, x, y, w, 78, 'rgba(10,12,24,0.55)')
    ctx.textAlign = alignRight ? 'right' : 'left'
    const textX = alignRight ? x + w - 14 : x + 14
    ctx.font = "bold 16px 'Jua', sans-serif"
    ctx.fillStyle = '#ffffff'
    const megaTag = c.isMega ? ' ⭐메가' : ''
    ctx.fillText(`${c.def.name}${megaTag}`, textX, y + 22)

    const barX = alignRight ? x + 14 : x + 14
    const barW = w - 28
    drawBar(ctx, barX, y + 32, barW, 14, c.hp / c.maxHp, c.hp / c.maxHp > 0.3 ? '#5ce17a' : '#ff5252')
    ctx.font = "11px 'Gowun Dodum', sans-serif"
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${Math.round(c.hp)} / ${c.maxHp}`, barX + barW / 2, y + 42)

    drawBar(ctx, barX, y + 52, barW, 9, c.megaGauge / 100, c.def.megaColor, 'rgba(0,0,0,0.4)')

    if (c.isStunned()) {
      ctx.textAlign = 'center'
      ctx.font = "bold 12px 'Jua', sans-serif"
      ctx.fillStyle = '#ffe066'
      ctx.fillText(`기절! ${c.stunTimer.toFixed(1)}s`, barX + barW / 2, y + 72)
    }
  }

  private renderMatchResultOverlay(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    drawPanel(ctx, CANVAS_W / 2 - 220, 150, 440, 320, 'rgba(20,24,40,0.9)')
    ctx.textAlign = 'center'
    ctx.font = "bold 38px 'Jua', sans-serif"
    ctx.fillStyle = this.matchWon ? '#ffe066' : '#ff8a80'
    ctx.fillText(this.matchWon ? '승리!' : '패배...', CANVAS_W / 2, 220)

    ctx.font = "18px 'Gowun Dodum', sans-serif"
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`최종 스코어  ${this.score.player} : ${this.score.ai}`, CANVAS_W / 2, 260)
    ctx.fillStyle = '#8fe34f'
    ctx.fillText(`+${this.matchMoneyEarned} 💰 획득!`, CANVAS_W / 2, 292)

    const btns: Button[] = [
      { id: 'rematch', x: CANVAS_W / 2 - 190, y: 330, w: 180, h: 48, label: '다시하기' },
      { id: 'to-shop', x: CANVAS_W / 2 + 10, y: 330, w: 180, h: 48, label: '상점 가기' },
      { id: 'to-menu', x: CANVAS_W / 2 - 100, y: 390, w: 200, h: 44, label: '메인 메뉴' },
    ]
    for (const b of btns) {
      drawButton(ctx, b, this.isHover(b), '#8fd6ff')
      this.buttons.push(b)
    }
    ctx.restore()
  }

  private renderPauseOverlay(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    drawPanel(ctx, CANVAS_W / 2 - 160, 200, 320, 220, 'rgba(20,24,40,0.9)')
    ctx.textAlign = 'center'
    ctx.font = "bold 28px 'Jua', sans-serif"
    ctx.fillStyle = '#ffffff'
    ctx.fillText('일시정지', CANVAS_W / 2, 250)

    const resumeBtn: Button = { id: 'resume', x: CANVAS_W / 2 - 120, y: 280, w: 240, h: 48, label: '계속하기' }
    const forfeitBtn: Button = { id: 'forfeit', x: CANVAS_W / 2 - 120, y: 340, w: 240, h: 48, label: '경기 포기' }
    drawButton(ctx, resumeBtn, this.isHover(resumeBtn), '#8fe34f')
    drawButton(ctx, forfeitBtn, this.isHover(forfeitBtn), '#ff8a80')
    this.buttons.push(resumeBtn, forfeitBtn)
    ctx.restore()
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lineHeight
    } else {
      line = testLine
    }
  }
  if (line) ctx.fillText(line, x, cy)
}
