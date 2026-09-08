import * as THREE from 'three'
import type { SpeciesDef } from '../core/types.ts'
import { buildCritterMesh } from './meshFactory.ts'

export type AnimalState = 'wild' | 'roped' | 'penned'

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

let nextId = 1

/** 자연에 사는 동물 한 마리 (야생 → 포획됨 → 사육 상태를 오간다) */
export class Animal {
  readonly id = nextId++
  readonly species: SpeciesDef
  readonly mesh: THREE.Group
  state: AnimalState = 'wild'
  bounds: Bounds

  /** 날개가 있는 종은 하늘을 날아다니다가 땅/물 위에 내려앉는다 */
  private readonly flies: boolean
  /** 조개/게처럼 주기적으로 땅속에 숨는 종 */
  private readonly canBurrow: boolean
  /** 바다·강의 날짐승이 수면 위에도 내려앉을 수 있도록 별도로 지정하는 착지 범위 */
  private waterLandingBounds: Bounds | null = null

  private airborne = false
  private burrowed = false
  private airborneAltitude = 3
  private specialTimer = 3 + Math.random() * 6

  private wanderTarget = new THREE.Vector3()
  private wanderTimer = 0
  private cryTimer = 4 + Math.random() * 10
  private bobPhase = Math.random() * Math.PI * 2

  constructor(species: SpeciesDef, spawnPos: THREE.Vector3, bounds: Bounds) {
    this.species = species
    this.bounds = bounds
    this.flies = species.wingType !== 'none'
    this.canBurrow = species.canBurrow
    this.mesh = buildCritterMesh(species)
    this.mesh.position.copy(spawnPos)
    this.mesh.userData.animalId = this.id
    this.wanderTarget.copy(spawnPos)
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  /** 지금 밧줄로 포획할 수 있는 상태인지 (하늘을 날거나 땅속에 숨어 있으면 포획 불가) */
  get capturable(): boolean {
    return this.state === 'wild' && !this.airborne && !this.burrowed
  }

  get isAirborne(): boolean {
    return this.airborne
  }

  get isBurrowed(): boolean {
    return this.burrowed
  }

  /** 바다/강 위에도 내려앉을 수 있는 비행 종에게 수면 착지 범위를 알려준다 */
  setWaterLandingBounds(bounds: Bounds): void {
    this.waterLandingBounds = bounds
  }

  /** 포획 등으로 강제 이동시킬 때 비행/매몰 상태를 초기화해 눈에 보이는 정상 상태로 되돌린다 */
  resetSpecialState(): void {
    this.airborne = false
    this.burrowed = false
    this.mesh.visible = true
    this.mesh.position.y = 0
  }

  private pickWanderTarget(): void {
    let b = this.bounds
    let y = 0
    if (this.flies) {
      if (this.airborne) {
        // 비행 중엔 이번 비행 동안 유지할 고도(this.airborneAltitude)를 그대로 쓰고,
        // 좌우 이동 목표만 새로 고른다 (그래야 목표 지점이 바뀔 때마다 고도가 들쭉날쭉하지 않는다)
        y = this.airborneAltitude
      } else if (this.waterLandingBounds && Math.random() < 0.5) {
        b = this.waterLandingBounds
        y = 0.02
      }
    }
    this.wanderTarget.set(
      THREE.MathUtils.randFloat(b.minX, b.maxX),
      y,
      THREE.MathUtils.randFloat(b.minZ, b.maxZ),
    )
    this.wanderTimer = 3 + Math.random() * 5
  }

  /** 야생 상태에서 하늘을 날거나 땅속에 숨는 상태를 주기적으로 전환한다 */
  private updateSpecialMode(dt: number): void {
    if (!this.flies && !this.canBurrow) return
    this.specialTimer -= dt
    if (this.specialTimer > 0) return

    if (this.flies) {
      this.airborne = !this.airborne
      if (this.airborne) this.airborneAltitude = 2.5 + Math.random() * 3
      this.specialTimer = this.airborne ? 6 + Math.random() * 10 : 5 + Math.random() * 12
    } else if (this.canBurrow) {
      this.burrowed = !this.burrowed
      this.mesh.visible = !this.burrowed
      this.specialTimer = this.burrowed ? 4 + Math.random() * 8 : 5 + Math.random() * 10
    }
    this.pickWanderTarget()
  }

  /** 매 프레임 갱신. 야생/사육 상태에서만 자율적으로 움직인다 (포획 중엔 RopeController가 위치를 제어). */
  update(dt: number): { cried: boolean } {
    this.cryTimer -= dt
    let cried = false
    if (this.cryTimer <= 0) {
      this.cryTimer = 10 + Math.random() * 16
      cried = this.state !== 'roped' && !this.burrowed
    }

    if (this.state === 'wild' || this.state === 'penned') {
      if (this.state === 'wild') this.updateSpecialMode(dt)

      if (this.burrowed) {
        return { cried }
      }

      const targetDist2D = Math.hypot(this.wanderTarget.x - this.position.x, this.wanderTarget.z - this.position.z)
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0 || targetDist2D < 0.3) {
        this.pickWanderTarget()
      }
      const toTarget = new THREE.Vector3().subVectors(this.wanderTarget, this.position)
      toTarget.y = 0
      const dist = toTarget.length()
      if (dist > 0.05) {
        toTarget.normalize()
        const speed = this.species.wanderSpeed * (this.state === 'penned' ? 0.6 : 1)
        this.position.addScaledVector(toTarget, speed * dt)
        const flatAngle = Math.atan2(toTarget.x, toTarget.z)
        this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, flatAngle, dt * 4)
      }
      if (this.flies) {
        // 고도는 좌우 이동 속도와 별개로, 항상 일정한 속도로 목표 고도까지 오르내린다
        const VERTICAL_SPEED = 2.2
        const dy = this.wanderTarget.y - this.mesh.position.y
        const step = Math.sign(dy) * Math.min(Math.abs(dy), VERTICAL_SPEED * dt)
        this.mesh.position.y += step
      } else {
        this.bobPhase += dt * 6
        this.mesh.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.04
      }
    }

    return { cried }
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    this.waterLandingBounds = null
    this.pickWanderTarget()
  }
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * Math.min(t, 1)
}
