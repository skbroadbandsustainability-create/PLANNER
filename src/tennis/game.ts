import { CHARACTER_LIST, getCharacter, skillCooldownAtLevel, skillDamageAtLevel } from './characters.ts'
import {
  AI_MIN_Z,
  COURT_HALF_DEPTH,
  COURT_HALF_WIDTH,
  HIT_REACH,
  OUT_MARGIN,
  PLAYER_MAX_Z,
  POINTS_TO_WIN,
} from './constants.ts'
import type { DomUI } from './dom.ts'
import { Ball, Character } from './entities.ts'
import type { Side } from './entities.ts'
import { input } from './input.ts'
import { addMoney, loadSave, tryCharacterLevelUp, trySkillUpgrade } from './save.ts'
import type { Scene3D } from './scene3d.ts'
import type { CharacterDef, GameStateName, MonsterId, SkillDef, StatusEffect } from './types.ts'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

const NORMAL_HIT_SPEED = 7.5
const SERVE_SPEED = 5.5
const AIM_DEPTH = COURT_HALF_DEPTH - 0.5

export const MATCH_SCREENS: GameStateName[] = ['playing', 'pointResult', 'matchResult', 'paused']

export class TennisGame {
  screen: GameStateName = 'menu'
  selectedId: MonsterId = 'abysnaga'
  shopCharId: MonsterId = 'abysnaga'

  player: Character | null = null
  ai: Character | null = null
  ball: Ball | null = null

  score = { player: 0, ai: 0 }
  server: Side = 'player'
  private rallyTimer = 0
  pointBanner = ''
  pointBannerTimer = 0

  matchMoneyEarned = 0
  matchWon = false

  private time = 0
  private scene: Scene3D
  private dom: DomUI

  constructor(scene: Scene3D, dom: DomUI) {
    this.scene = scene
    this.dom = dom
  }

  // ---------------------------------------------------------------------
  // 화면 전환 / 버튼 동작
  // ---------------------------------------------------------------------

  dispatch(id: string): void {
    if (id.startsWith('pick-')) {
      this.selectedId = id.slice('pick-'.length) as MonsterId
      return
    }
    if (id.startsWith('shop-tab-')) {
      this.shopCharId = id.slice('shop-tab-'.length) as MonsterId
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
      case 'pause-game':
        if (this.screen === 'playing') this.screen = 'paused'
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

  getPreviewDef(): CharacterDef {
    if (this.screen === 'shop') return getCharacter(this.shopCharId)
    return getCharacter(this.selectedId)
  }

  private setupMatch(playerId: MonsterId): void {
    const save = loadSave()
    const playerDef = getCharacter(playerId)
    const others = CHARACTER_LIST.filter((c) => c.id !== playerId)
    const aiDef = others[Math.floor(Math.random() * others.length)]

    const playerProgress = save.characters[playerId]

    this.player = new Character(playerDef, 'player', 0, PLAYER_MAX_Z - 0.6, playerProgress.level, playerProgress.skillLevels)

    const aiSkillLevels: Record<string, number> = {}
    aiSkillLevels[aiDef.skills[0].id] = clamp(Math.ceil(playerProgress.level * 0.7), 1, aiDef.skills[0].maxLevel)
    if (playerProgress.level >= 3) {
      aiSkillLevels[aiDef.skills[1].id] = clamp(
        Math.ceil((playerProgress.level - 1) * 0.5),
        1,
        aiDef.skills[1].maxLevel,
      )
    }
    const aiLevel = clamp(Math.round(playerProgress.level * 0.9), 1, 10)
    this.ai = new Character(aiDef, 'ai', 0, AI_MIN_Z + 0.6, aiLevel, aiSkillLevels)

    this.ball = new Ball(0, 0)
    this.score = { player: 0, ai: 0 }
    this.scene.setupMatch(playerDef, aiDef)
    this.scene.clearParticles()
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
    input.endFrame()

    this.dom.syncScreens({ screen: this.screen, selectedId: this.selectedId, shopCharId: this.shopCharId })
    if (MATCH_SCREENS.includes(this.screen) && this.player && this.ai) {
      this.dom.syncHud({
        player: this.player,
        ai: this.ai,
        score: this.score,
        pointBanner: this.pointBanner,
        pointBannerTimer: this.pointBannerTimer,
        matchWon: this.matchWon,
        matchMoneyEarned: this.matchMoneyEarned,
      })
    }
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
    if (player.hp <= 0 && player.stunTimer <= 0) player.stunTimer = 5
    if (ai.hp <= 0 && ai.stunTimer <= 0) ai.stunTimer = 5

    if (input.pausePressed) this.screen = 'paused'
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
    return Math.hypot(c.x - ball.x, c.z - ball.z) <= HIT_REACH
  }

  private isDefenderTurn(c: Character, ball: Ball): boolean {
    return ball.inPlay && ball.lastHitBy !== null && ball.lastHitBy !== c.side
  }

  private handlePlayerInput(player: Character, ball: Ball, dt: number): void {
    if (!player.isStunned()) {
      let mx = input.moveX
      let mz = input.moveY
      if (player.isConfused) {
        mx = -mx
        mz = -mz
      }
      const len = Math.hypot(mx, mz)
      if (len > 0) {
        mx /= len
        mz /= len
        const b = player.moveBounds()
        player.x = clamp(player.x + mx * player.effectiveSpeed * dt, b.minX, b.maxX)
        player.z = clamp(player.z + mz * player.effectiveSpeed * dt, b.minZ, b.maxZ)
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
    const centerZ = (b.minZ + b.maxZ) / 2

    let targetX = ai.x
    let targetZ = centerZ
    if (ball.inPlay && ball.lastHitBy !== 'ai') {
      targetX = ball.x + Math.sin(this.time * 3.1) * 0.15
      targetZ = clamp(ball.z, b.minZ, b.maxZ)
    } else {
      targetX = 0
      targetZ = centerZ
    }

    const dx = targetX - ai.x
    const dz = targetZ - ai.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.05) {
      const spd = ai.effectiveSpeed
      ai.x = clamp(ai.x + (dx / dist) * spd * dt, b.minX, b.maxX)
      ai.z = clamp(ai.z + (dz / dist) * spd * dt, b.minZ, b.maxZ)
    }

    if (this.isDefenderTurn(ai, ball) && this.ballInReach(ai, ball)) {
      this.aiAttemptHit(ai)
    }
  }

  private aiAttemptHit(ai: Character): void {
    const available = ai.def.skills.filter((s) => (ai.skillLevels[s.id] ?? 0) > 0 && ai.cooldowns[s.id] === 0)
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
    this.scene.spawnHitImpact(c.x, 0.9, c.z, c.def.megaColor)
    this.scene.spawnConfetti(c.x, 1.2, c.z)
  }

  private pickAimTarget(attackerSide: Side, fromX: number, defenderX: number): { x: number; z: number } {
    const targetZ = attackerSide === 'player' ? -AIM_DEPTH : AIM_DEPTH
    let targetX: number
    if (attackerSide === 'player') {
      targetX = fromX * 1.3 + (Math.random() - 0.5) * 0.9
    } else if (Math.random() < 0.6) {
      const away = defenderX < 0 ? 1 : -1
      targetX = away * (0.9 + Math.random() * 1.6)
    } else {
      targetX = (Math.random() - 0.5) * 3.2
    }
    targetX = clamp(targetX, -(COURT_HALF_WIDTH - 0.3), COURT_HALF_WIDTH - 0.3)
    return { x: targetX, z: targetZ }
  }

  private performHit(attacker: Character, skill: SkillDef | null): void {
    const ball = this.ball
    if (!ball) return
    const defender = attacker.side === 'player' ? this.ai : this.player
    attacker.swingAnim = 0.16

    const target = this.pickAimTarget(attacker.side, attacker.x, defender ? defender.x : attacker.x)
    let speed = NORMAL_HIT_SPEED
    let damage = 0
    let status: StatusEffect | undefined

    if (skill) {
      const level = attacker.skillLevels[skill.id] ?? 0
      damage = skillDamageAtLevel(skill, level)
      speed = NORMAL_HIT_SPEED * 1.15
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
      this.scene.spawnSkillCast(attacker.x, 0.9, attacker.z, skill.element, skill.color)
    }
    speed *= attacker.outgoingSpeedMultiplier

    const dx = target.x - attacker.x
    const dz = target.z - attacker.z
    const dist = Math.hypot(dx, dz) || 1
    ball.launch((dx / dist) * speed, (dz / dist) * speed, attacker.side, dist / speed)
    ball.isSkillShot = !!skill
    ball.skillElement = skill?.element ?? null
    ball.skillColor = skill?.color ?? '#fff59d'
    ball.skillDamage = damage
    ball.pendingStatus = status ?? null

    this.scene.spawnRacketHit(attacker.x, 0.75, attacker.z, skill?.color ?? '#ffffff')

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
    const startX = clamp((Math.random() - 0.5) * 1.6, -(COURT_HALF_WIDTH - 0.6), COURT_HALF_WIDTH - 0.6)
    const startZ = server === 'player' ? PLAYER_MAX_Z - 0.3 : AI_MIN_Z + 0.3
    ball.x = startX
    ball.z = startZ
    ball.trail = []
    ball.clearSkill()

    const defenderX = server === 'player' ? ai.x : player.x
    const target = this.pickAimTarget(server, startX, defenderX)
    const dx = target.x - startX
    const dz = target.z - startZ
    const dist = Math.hypot(dx, dz) || 1
    ball.launch((dx / dist) * SERVE_SPEED, (dz / dist) * SERVE_SPEED, server, dist / SERVE_SPEED)
  }

  private checkOutOfBounds(ball: Ball): void {
    if (!ball.inPlay) return
    if (ball.z - ball.radius > COURT_HALF_DEPTH + OUT_MARGIN && ball.lastHitBy === 'ai') {
      this.awardPoint('ai')
    } else if (ball.z + ball.radius < -(COURT_HALF_DEPTH + OUT_MARGIN) && ball.lastHitBy === 'player') {
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
      this.scene.spawnHitImpact(loserChar.x, 0.9, loserChar.z, ball.skillColor)
      if (ball.pendingStatus) loserChar.applyStatus(ball.pendingStatus)
      if (loserChar.hp <= 0) {
        loserChar.stunTimer = 5
        banner = winner === 'player' ? '기절! 찬스다!' : '위험! 기절당함...'
      }
    }

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
    if (won && this.player) this.scene.spawnConfetti(0, 1.4, 0)
    this.screen = 'matchResult'
  }

  // ---------------------------------------------------------------------
  // 3D 씬 동기화 (매 프레임 main.ts 루프에서 호출)
  // ---------------------------------------------------------------------

  syncScene(dt: number): void {
    if (MATCH_SCREENS.includes(this.screen) && this.player && this.ai && this.ball) {
      this.scene.updatePlayer(this.player, dt)
      this.scene.updateAi(this.ai, dt)
      this.scene.updateBall(this.ball)
      this.scene.updateCameraFollow(this.player.x, dt)
      this.scene.updateParticles(dt)
      this.scene.renderMatch()
    } else {
      this.scene.showPreview(this.getPreviewDef())
      this.scene.updatePreview(dt)
      this.scene.renderPreview()
    }
  }
}
