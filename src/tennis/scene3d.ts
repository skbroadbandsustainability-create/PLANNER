// Three.js 기반 3D 렌더링 레이어.
// three.js는 <script> 태그(CDN)로 로드되어 전역 THREE 객체로 제공된다 (번들에 포함하지 않음).
declare const THREE: any

import type { Character, Ball } from './entities.ts'
import type { CharacterDef, SkillElement } from './types.ts'
import {
  AI_MIN_Z,
  BALL_RADIUS,
  COURT_HALF_DEPTH,
  COURT_HALF_WIDTH,
  NET_Z,
  PLAYER_MAX_Z,
  WALL_MARGIN,
  WALL_X,
} from './constants.ts'

interface CharMeshHandle {
  group: any
  weaponPivot: any
  bodyMaterials: any[]
  megaGlow: any
  stunGroup: any
  shadow: any
  bobPhase: number
  baseY: number
}

interface Particle3D {
  sprite: any
  vx: number
  vy: number
  vz: number
  gravity: number
  life: number
  maxLife: number
}

const NOMINAL_RADIUS = 0.65

function hex(c: string): number {
  return parseInt(c.replace('#', ''), 16)
}

export class Scene3D {
  private renderer: any
  private matchScene: any
  private previewScene: any
  private matchCamera: any
  private previewCamera: any
  private width = 1
  private height = 1
  private time = 0

  private ballMesh: any
  private ballShadow: any
  private ballTrailPool: any[] = []
  private particleTexture: any
  private particles: Particle3D[] = []

  private playerHandle: CharMeshHandle | null = null
  private aiHandle: CharMeshHandle | null = null
  private previewHandle: CharMeshHandle | null = null
  private previewDef: CharacterDef | null = null

  private cameraFollowX = 0

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))

    this.matchScene = new THREE.Scene()
    this.matchScene.background = new THREE.Color(0x0c1226)
    this.matchScene.fog = new THREE.Fog(0x0c1226, 14, 34)

    this.previewScene = new THREE.Scene()
    this.previewScene.background = new THREE.Color(0x14172c)

    this.matchCamera = new THREE.PerspectiveCamera(52, 1, 0.1, 100)
    this.previewCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    this.previewCamera.position.set(0, 1.5, 7.4)
    this.previewCamera.lookAt(0, 0.85, 0)

    this.buildParticleTexture()
    this.buildCourt()
    this.buildBall()
    this.buildPreviewStage()
  }

  resize(w: number, h: number): void {
    this.width = w
    this.height = h
    this.renderer.setSize(w, h, false)
    this.matchCamera.aspect = w / h
    this.matchCamera.updateProjectionMatrix()
    this.previewCamera.aspect = w / h
    this.previewCamera.updateProjectionMatrix()
  }

  // -----------------------------------------------------------------
  // 코트 / 조명
  // -----------------------------------------------------------------

  private buildCourt(): void {
    const scene = this.matchScene

    scene.add(new THREE.HemisphereLight(0x9fd0ff, 0x1a2a12, 0.75))
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.05)
    sun.position.set(6, 12, 7)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0x7fbfff, 0.35)
    fill.position.set(-8, 6, -6)
    scene.add(fill)

    // 코트 주변 잔디/외곽
    const apronGeo = new THREE.PlaneGeometry(WALL_X * 4.2, COURT_HALF_DEPTH * 4.4)
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x1c5a34, roughness: 0.95, flatShading: true })
    const apron = new THREE.Mesh(apronGeo, apronMat)
    apron.rotation.x = -Math.PI / 2
    apron.position.y = -0.02
    scene.add(apron)

    // 코트 바닥
    const courtGeo = new THREE.PlaneGeometry(WALL_X * 2, COURT_HALF_DEPTH * 2 + 0.6)
    const courtMat = new THREE.MeshStandardMaterial({ color: 0x2f5fb0, roughness: 0.75, flatShading: true })
    const court = new THREE.Mesh(courtGeo, courtMat)
    court.rotation.x = -Math.PI / 2
    scene.add(court)

    // 라인
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const addLine = (w: number, d: number, x: number, z: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), lineMat)
      line.position.set(x, 0.01, z)
      scene.add(line)
    }
    addLine(0.08, COURT_HALF_DEPTH * 2, -COURT_HALF_WIDTH, 0)
    addLine(0.08, COURT_HALF_DEPTH * 2, COURT_HALF_WIDTH, 0)
    addLine(COURT_HALF_WIDTH * 2, 0.08, 0, PLAYER_MAX_Z + 0.3)
    addLine(COURT_HALF_WIDTH * 2, 0.08, 0, AI_MIN_Z - 0.3)
    addLine(0.05, COURT_HALF_DEPTH * 2, 0, 0)

    // 네트
    const netGroup = new THREE.Group()
    const netCanvas = document.createElement('canvas')
    netCanvas.width = 64
    netCanvas.height = 32
    const nctx = netCanvas.getContext('2d')!
    nctx.strokeStyle = 'rgba(20,20,30,0.65)'
    nctx.lineWidth = 1.5
    for (let i = 0; i <= 8; i++) {
      nctx.beginPath()
      nctx.moveTo((i * 64) / 8, 0)
      nctx.lineTo((i * 64) / 8, 32)
      nctx.stroke()
    }
    for (let i = 0; i <= 4; i++) {
      nctx.beginPath()
      nctx.moveTo(0, (i * 32) / 4)
      nctx.lineTo(64, (i * 32) / 4)
      nctx.stroke()
    }
    const netTex = new THREE.CanvasTexture(netCanvas)
    const netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(COURT_HALF_WIDTH * 2 + 0.3, 0.75),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, opacity: 0.92 }),
    )
    netMesh.position.set(0, 0.38, NET_Z)
    netGroup.add(netMesh)
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, flatShading: true })
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6), postMat)
      post.position.set(side * (COURT_HALF_WIDTH + 0.15), 0.42, NET_Z)
      netGroup.add(post)
    }
    scene.add(netGroup)

    // 투명한 벽
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x8fe4ff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(COURT_HALF_DEPTH * 2 + 1, 3.2), wallMat)
      wall.position.set(side * WALL_X, 1.5, 0)
      wall.rotation.y = Math.PI / 2
      wall.userData.isWall = true
      scene.add(wall)
    }

    // 스타디움 조명탑 (분위기용)
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 4.5, 6),
        new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true }),
      )
      const px = sx * (WALL_X + WALL_MARGIN + 0.8)
      const pz = sz * (COURT_HALF_DEPTH + 1.2)
      pole.position.set(px, 2.2, pz)
      scene.add(pole)
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
      )
      lamp.position.set(px, 4.5, pz)
      scene.add(lamp)
      const lampLight = new THREE.PointLight(0xfff2c0, 0.4, 10)
      lampLight.position.set(px, 4.3, pz)
      scene.add(lampLight)
    }
  }

  private buildPreviewStage(): void {
    const scene = this.previewScene
    scene.add(new THREE.HemisphereLight(0xaad4ff, 0x120a1e, 0.8))
    const key = new THREE.DirectionalLight(0xffe9c2, 1.1)
    key.position.set(3, 5, 4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fd6ff, 0.6)
    rim.position.set(-4, 2, -3)
    scene.add(rim)

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.5, 0.25, 7),
      new THREE.MeshStandardMaterial({ color: 0x21254a, flatShading: true, roughness: 0.6 }),
    )
    pedestal.position.y = -0.12
    scene.add(pedestal)
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.35, 24),
      new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    )
    glow.rotation.x = -Math.PI / 2
    glow.position.y = 0.02
    scene.add(glow)
  }

  private buildBall(): void {
    const geo = new THREE.IcosahedronGeometry(BALL_RADIUS, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0xf4ff5e, flatShading: true, roughness: 0.5 })
    this.ballMesh = new THREE.Mesh(geo, mat)
    this.ballMesh.visible = false
    this.matchScene.add(this.ballMesh)

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_RADIUS * 1.4, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    )
    this.ballShadow.rotation.x = -Math.PI / 2
    this.ballShadow.position.y = 0.012
    this.ballShadow.visible = false
    this.matchScene.add(this.ballShadow)

    for (let i = 0; i < 9; i++) {
      const t = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS * 0.7, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xf4ff5e, transparent: true, opacity: 0.3 }),
      )
      t.visible = false
      this.matchScene.add(t)
      this.ballTrailPool.push(t)
    }
  }

  // -----------------------------------------------------------------
  // 몬스터 프로시저럴 모델
  // -----------------------------------------------------------------

  private makeMat(color: number, emissive = 0x000000, intensity = 0): any {
    return new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: intensity,
      flatShading: true,
      roughness: 0.55,
      metalness: 0.12,
    })
  }

  private createMonsterGroup(def: CharacterDef): CharMeshHandle {
    const group = new THREE.Group()
    const bodyColor = hex(def.color)
    const accentColor = hex(def.accentColor)
    const bodyMaterials: any[] = []
    let weaponPivot: any = new THREE.Group()
    let baseY = 0.7

    const bodyMat = this.makeMat(bodyColor)
    const accentMat = this.makeMat(accentColor)
    bodyMaterials.push(bodyMat, accentMat)

    if (def.id === 'abysnaga') {
      baseY = 0.55
      const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), bodyMat)
      torso.scale.set(0.85, 0.8, 1.5)
      torso.position.y = 0.55
      torso.rotation.x = -0.15
      group.add(torso)

      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 5), bodyMat)
      head.rotation.x = Math.PI / 2
      head.position.set(0, 0.62, -0.75)
      group.add(head)

      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0b1622, emissive: 0x5be6ff, emissiveIntensity: 1.6 })
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), eyeMat)
        eye.position.set(s * 0.13, 0.68, -0.95)
        group.add(eye)
      }

      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 4), accentMat)
      fin.rotation.x = -0.5
      fin.position.set(0, 1.05, 0.15)
      group.add(fin)

      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.3, 5), bodyMat)
      tail.rotation.x = Math.PI / 2
      tail.position.set(0, 0.35, 0.95)
      group.add(tail)

      for (const s of [-1, 1]) {
        const bladePivot = new THREE.Group()
        bladePivot.position.set(s * 0.42, 0.6, -0.15)
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 4), accentMat)
        blade.rotation.z = s * 1.05
        blade.position.set(s * 0.3, -0.05, 0)
        bladePivot.add(blade)
        group.add(bladePivot)
        if (s === 1) weaponPivot = bladePivot
      }
    } else if (def.id === 'drumjaw') {
      baseY = 0.75
      const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), bodyMat)
      torso.scale.set(1.05, 1.0, 0.85)
      torso.position.y = 0.85
      group.add(torso)

      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.34, 8), accentMat)
      drum.rotation.z = Math.PI / 2
      drum.position.set(0, 0.85, 0.55)
      group.add(drum)
      const drumSkin = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9c48a, flatShading: true }),
      )
      drumSkin.position.set(0, 0.85, 0.73)
      group.add(drumSkin)

      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), bodyMat)
      head.position.set(0, 1.42, -0.1)
      group.add(head)
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1206, emissive: 0xffb347, emissiveIntensity: 1.4 })
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), eyeMat)
        eye.position.set(s * 0.14, 1.46, -0.35)
        group.add(eye)
      }
      for (let i = -1; i <= 1; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), accentMat)
        spike.position.set(i * 0.14, 1.72, -0.05)
        group.add(spike)
      }

      for (const s of [-1, 1]) {
        const armPivot = new THREE.Group()
        armPivot.position.set(s * 0.68, 1.05, 0)
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.6, 6), bodyMat)
        arm.position.set(0, -0.3, 0)
        armPivot.add(arm)
        const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), accentMat)
        fist.position.set(0, -0.62, 0)
        armPivot.add(fist)
        group.add(armPivot)
        if (s === 1) weaponPivot = armPivot
      }

      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.55, 6), bodyMat)
        leg.position.set(s * 0.3, 0.28, 0)
        group.add(leg)
      }
    } else {
      // ignisphere
      baseY = 0.9
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 6), bodyMat)
      core.rotation.x = Math.PI
      core.position.y = 0.85
      group.add(core)

      const eyeOrb = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x1a0d2b, emissive: 0xb06bff, emissiveIntensity: 1.8 }),
      )
      eyeOrb.position.set(0, 1.05, 0.42)
      group.add(eyeOrb)

      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), accentMat)
        flame.position.set(Math.cos(a) * 0.34, 1.15 + Math.sin(a) * 0.1, Math.sin(a) * 0.34)
        flame.rotation.x = Math.cos(a) * 0.5
        flame.rotation.z = Math.sin(a) * -0.5
        flame.userData.flameIndex = i
        group.add(flame)
      }

      for (const s of [-1, 1]) {
        const wispPivot = new THREE.Group()
        wispPivot.position.set(s * 0.4, 0.75, 0)
        const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 4), accentMat)
        wisp.rotation.z = s * 0.7
        wisp.position.set(s * 0.2, -0.15, 0)
        wispPivot.add(wisp)
        group.add(wispPivot)
        if (s === 1) weaponPivot = wispPivot
      }
    }

    const megaGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 0),
      new THREE.MeshBasicMaterial({
        color: hex(def.megaColor),
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      }),
    )
    megaGlow.visible = false
    group.add(megaGlow)

    const stunGroup = new THREE.Group()
    const starMat = new THREE.MeshBasicMaterial({ color: 0xfff176 })
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), starMat)
      stunGroup.add(star)
    }
    stunGroup.visible = false
    stunGroup.position.y = baseY + 1.1
    group.add(stunGroup)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(def.radius * 1.1, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.012

    const scale = def.radius / NOMINAL_RADIUS
    group.scale.setScalar(scale)

    return { group, weaponPivot, bodyMaterials, megaGlow, stunGroup, shadow, bobPhase: Math.random() * 10, baseY }
  }

  // -----------------------------------------------------------------
  // 경기 캐릭터 배치/동기화
  // -----------------------------------------------------------------

  setupMatch(playerDef: CharacterDef, aiDef: CharacterDef): void {
    if (this.playerHandle) this.matchScene.remove(this.playerHandle.group, this.playerHandle.shadow)
    if (this.aiHandle) this.matchScene.remove(this.aiHandle.group, this.aiHandle.shadow)
    this.playerHandle = this.createMonsterGroup(playerDef)
    this.aiHandle = this.createMonsterGroup(aiDef)
    this.matchScene.add(this.playerHandle.group, this.playerHandle.shadow)
    this.matchScene.add(this.aiHandle.group, this.aiHandle.shadow)
  }

  private syncHandle(handle: CharMeshHandle, character: Character, dt: number): void {
    handle.group.position.set(character.x, 0, character.z)
    handle.shadow.position.set(character.x, 0.012, character.z)
    handle.group.rotation.y = character.side === 'player' ? 0 : Math.PI

    const swing = Math.sin(Math.min(1, character.swingAnim * 6) * Math.PI) * (character.swingAnim > 0 ? 1 : 0)
    handle.weaponPivot.rotation.x = -swing * 1.3

    const squash = 1 - Math.min(0.2, character.swingAnim * 1.3)
    const stretch = 1 + Math.min(0.2, character.swingAnim * 1.3)
    const baseScale = handle.group.userData.baseScale ?? handle.group.scale.x
    handle.group.userData.baseScale = baseScale
    handle.group.scale.set(baseScale * stretch, baseScale * squash, baseScale * stretch)

    const stunned = character.isStunned()
    handle.stunGroup.visible = stunned
    if (stunned) {
      handle.stunGroup.rotation.y += dt * 4
      handle.stunGroup.children.forEach((star: any, i: number) => {
        const a = (i / handle.stunGroup.children.length) * Math.PI * 2
        star.position.set(Math.cos(a) * 0.35, Math.sin(this.time * 5 + i) * 0.06, Math.sin(a) * 0.35)
      })
      handle.group.position.x += Math.sin(this.time * 14) * 0.03
    }

    handle.megaGlow.visible = character.isMega
    if (character.isMega) {
      const pulse = 0.85 + Math.sin(this.time * 5) * 0.08
      handle.megaGlow.scale.setScalar(pulse)
    }

    if (character.def.id === 'ignisphere') {
      handle.bobPhase += dt
      handle.group.position.y = Math.sin(handle.bobPhase * 2.2) * 0.12
      handle.group.children.forEach((child: any) => {
        if (child.userData.flameIndex !== undefined) {
          child.rotation.y += dt * 3
        }
      })
    }

    const flashT = character.hitFlash / 0.35
    for (const mat of handle.bodyMaterials) {
      mat.emissiveIntensity = flashT > 0 ? flashT * 1.6 : mat.emissiveIntensity > 0 && !character.isMega ? 0 : mat.emissiveIntensity
      if (flashT > 0) mat.emissive.setHex(0xffffff)
    }
  }

  updatePlayer(character: Character, dt: number): void {
    if (this.playerHandle) this.syncHandle(this.playerHandle, character, dt)
  }

  updateAi(character: Character, dt: number): void {
    if (this.aiHandle) this.syncHandle(this.aiHandle, character, dt)
  }

  updateBall(ball: Ball): void {
    if (!ball.inPlay) {
      this.ballMesh.visible = false
      this.ballShadow.visible = false
      for (const t of this.ballTrailPool) t.visible = false
      return
    }
    const y = ball.height + BALL_RADIUS
    this.ballMesh.visible = true
    this.ballMesh.position.set(ball.x, y, ball.z)
    this.ballMesh.material.color.setHex(ball.isSkillShot ? hex(ball.skillColor) : 0xf4ff5e)
    this.ballMesh.rotation.x += 0.2
    this.ballMesh.rotation.y += 0.15

    this.ballShadow.visible = true
    const shadowScale = Math.max(0.4, 1.3 - ball.height * 0.35)
    this.ballShadow.scale.setScalar(shadowScale)
    this.ballShadow.material.opacity = Math.max(0.08, 0.38 - ball.height * 0.09)
    this.ballShadow.position.set(ball.x, 0.012, ball.z)

    const trail = ball.trail
    for (let i = 0; i < this.ballTrailPool.length; i++) {
      const t = this.ballTrailPool[i]
      const src = trail[trail.length - 1 - i]
      if (!src) {
        t.visible = false
        continue
      }
      t.visible = true
      t.position.set(src.x, src.y + BALL_RADIUS, src.z)
      t.material.opacity = 0.32 * (1 - i / this.ballTrailPool.length)
      t.material.color.setHex(ball.isSkillShot ? hex(ball.skillColor) : 0xf4ff5e)
    }
  }

  updateCameraFollow(playerX: number, dt: number): void {
    this.cameraFollowX += (playerX * 0.45 - this.cameraFollowX) * Math.min(1, dt * 3)
    this.matchCamera.position.set(this.cameraFollowX, 4.1, PLAYER_MAX_Z + 5.6)
    this.matchCamera.lookAt(this.cameraFollowX * 0.4, 0.7, -1.5)
  }

  // -----------------------------------------------------------------
  // 프리뷰(상점) 렌더링
  // -----------------------------------------------------------------

  showPreview(def: CharacterDef): void {
    if (this.previewDef?.id === def.id && this.previewHandle) return
    if (this.previewHandle) this.previewScene.remove(this.previewHandle.group)
    this.previewHandle = this.createMonsterGroup(def)
    const previewScale = (this.previewHandle.group.scale.x as number) * 0.55
    this.previewHandle.group.scale.setScalar(previewScale)
    this.previewHandle.group.position.y = -0.3
    this.previewScene.add(this.previewHandle.group)
    this.previewDef = def
  }

  updatePreview(dt: number): void {
    if (!this.previewHandle) return
    this.previewHandle.group.rotation.y += dt * 0.7
    this.previewHandle.group.position.y = -0.3 + Math.sin(this.time * 1.6) * 0.08
  }

  // -----------------------------------------------------------------
  // 파티클
  // -----------------------------------------------------------------

  private buildParticleTexture(): void {
    const c = document.createElement('canvas')
    c.width = 32
    c.height = 32
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 32, 32)
    this.particleTexture = new THREE.CanvasTexture(c)
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    color: number,
    opts: { speed?: number; up?: number; gravity?: number; life?: number; size?: number } = {},
  ): void {
    const mat = new THREE.SpriteMaterial({
      map: this.particleTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const sprite = new THREE.Sprite(mat)
    const size = opts.size ?? 0.14
    sprite.scale.setScalar(size)
    sprite.position.set(x, y, z)
    this.matchScene.add(sprite)

    const angle = Math.random() * Math.PI * 2
    const speed = opts.speed ?? 1.4
    this.particles.push({
      sprite,
      vx: Math.cos(angle) * speed,
      vz: Math.sin(angle) * speed,
      vy: opts.up ?? 1.6,
      gravity: opts.gravity ?? 3.2,
      life: opts.life ?? 0.5,
      maxLife: opts.life ?? 0.5,
    })
  }

  spawnRacketHit(x: number, y: number, z: number, color: string): void {
    for (let i = 0; i < 7; i++) {
      this.spawnParticle(x, y, z, hex(color), { speed: 1.2, up: 1.2, life: 0.3, size: 0.1 })
    }
  }

  spawnSkillCast(x: number, y: number, z: number, element: SkillElement, color: string): void {
    const count = element === 'clone' ? 5 : 12
    for (let i = 0; i < count; i++) {
      this.spawnParticle(x, y, z, hex(color), {
        speed: 0.8 + Math.random() * 1.4,
        up: element === 'fire' ? 2.2 : 1.4,
        gravity: element === 'fire' ? -0.5 : 2.4,
        life: 0.55 + Math.random() * 0.3,
        size: 0.11 + Math.random() * 0.05,
      })
    }
  }

  spawnHitImpact(x: number, y: number, z: number, color: string): void {
    for (let i = 0; i < 18; i++) {
      this.spawnParticle(x, y, z, hex(color), {
        speed: 1.8 + Math.random() * 2.2,
        up: 2.4,
        gravity: 4.5,
        life: 0.45 + Math.random() * 0.25,
        size: 0.1 + Math.random() * 0.05,
      })
    }
  }

  spawnConfetti(x: number, y: number, z: number): void {
    const colors = [0xffd54f, 0xff7043, 0x4fc3f7, 0x81c784, 0xba68c8]
    for (let i = 0; i < 34; i++) {
      this.spawnParticle(x, y, z, colors[i % colors.length], {
        speed: 1.6 + Math.random() * 2.6,
        up: 3.6 + Math.random() * 1.4,
        gravity: 5.5,
        life: 0.8 + Math.random() * 0.5,
        size: 0.12 + Math.random() * 0.05,
      })
    }
  }

  updateParticles(dt: number): void {
    this.time += dt
    for (const p of this.particles) {
      p.life -= dt
      p.vy -= p.gravity * dt
      p.sprite.position.x += p.vx * dt
      p.sprite.position.y += p.vy * dt
      p.sprite.position.z += p.vz * dt
      p.sprite.material.opacity = Math.max(0, p.life / p.maxLife)
    }
    const dead = this.particles.filter((p) => p.life <= 0)
    for (const p of dead) {
      this.matchScene.remove(p.sprite)
      p.sprite.material.dispose()
    }
    this.particles = this.particles.filter((p) => p.life > 0)
  }

  clearParticles(): void {
    for (const p of this.particles) {
      this.matchScene.remove(p.sprite)
      p.sprite.material.dispose()
    }
    this.particles = []
  }

  // -----------------------------------------------------------------
  // 화면 투영 (HP/데미지 텍스트 등 DOM 오버레이 위치 계산용)
  // -----------------------------------------------------------------

  worldToScreen(x: number, y: number, z: number, usePreview = false): { x: number; y: number } | null {
    const camera = usePreview ? this.previewCamera : this.matchCamera
    const v = new THREE.Vector3(x, y, z).project(camera)
    if (v.z > 1) return null
    return {
      x: ((v.x + 1) / 2) * this.width,
      y: ((1 - v.y) / 2) * this.height,
    }
  }

  renderMatch(): void {
    this.renderer.render(this.matchScene, this.matchCamera)
  }

  renderPreview(): void {
    this.renderer.render(this.previewScene, this.previewCamera)
  }
}
