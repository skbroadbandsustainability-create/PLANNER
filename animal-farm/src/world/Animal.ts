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

  private wanderTarget = new THREE.Vector3()
  private wanderTimer = 0
  private cryTimer = 4 + Math.random() * 10
  private bobPhase = Math.random() * Math.PI * 2

  constructor(species: SpeciesDef, spawnPos: THREE.Vector3, bounds: Bounds) {
    this.species = species
    this.bounds = bounds
    this.mesh = buildCritterMesh(species)
    this.mesh.position.copy(spawnPos)
    this.mesh.userData.animalId = this.id
    this.wanderTarget.copy(spawnPos)
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  private pickWanderTarget(): void {
    const b = this.bounds
    this.wanderTarget.set(
      THREE.MathUtils.randFloat(b.minX, b.maxX),
      0,
      THREE.MathUtils.randFloat(b.minZ, b.maxZ),
    )
    this.wanderTimer = 3 + Math.random() * 5
  }

  /** 매 프레임 갱신. 야생/사육 상태에서만 자율적으로 움직인다 (포획 중엔 RopeController가 위치를 제어). */
  update(dt: number): { cried: boolean } {
    this.cryTimer -= dt
    let cried = false
    if (this.cryTimer <= 0) {
      this.cryTimer = 10 + Math.random() * 16
      cried = this.state !== 'roped'
    }

    if (this.state === 'wild' || this.state === 'penned') {
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0 || this.wanderTarget.distanceTo(this.position) < 0.3) {
        this.pickWanderTarget()
      }
      const toTarget = new THREE.Vector3().subVectors(this.wanderTarget, this.position)
      toTarget.y = 0
      const dist = toTarget.length()
      if (dist > 0.05) {
        toTarget.normalize()
        const speed = this.species.wanderSpeed * (this.state === 'penned' ? 0.6 : 1)
        this.position.addScaledVector(toTarget, speed * dt)
        const targetAngle = Math.atan2(toTarget.x, toTarget.z)
        this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, targetAngle, dt * 4)
      }
      this.bobPhase += dt * 6
      this.mesh.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.04
    }

    return { cried }
  }

  setBounds(bounds: Bounds): void {
    this.bounds = bounds
    this.pickWanderTarget()
  }
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * Math.min(t, 1)
}
