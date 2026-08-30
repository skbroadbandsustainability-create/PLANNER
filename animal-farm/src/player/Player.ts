import * as THREE from 'three'
import { buildHumanoidMesh } from '../world/meshFactory.ts'

const BASE_SPEED = 4.4
const JUMP_SPEED = 6.6
const GRAVITY = -20

export interface MoveInput {
  x: number // -1..1 (좌우)
  z: number // -1..1 (앞뒤, -1이 전진)
  jump: boolean
}

/** 플레이어 캐릭터 "민주호" - 이동/점프를 담당 */
export class Player {
  readonly mesh: THREE.Group
  private velocityY = 0
  grounded = true
  facing = new THREE.Vector3(0, 0, -1)

  constructor() {
    this.mesh = buildHumanoidMesh({ shirt: 0xe0523a, pants: 0x2f4a6b, skin: 0xe8b98a, hat: 0x3a3530 })
    this.mesh.position.set(0, 0, 6)
  }

  get position(): THREE.Vector3 {
    return this.mesh.position
  }

  update(dt: number, input: MoveInput, speedMultiplier: number): void {
    const moveVec = new THREE.Vector3(input.x, 0, input.z)
    if (moveVec.lengthSq() > 1) moveVec.normalize()

    if (moveVec.lengthSq() > 0.0001) {
      const speed = BASE_SPEED * speedMultiplier
      this.mesh.position.addScaledVector(moveVec, speed * dt)
      this.facing.copy(moveVec).normalize()
      const targetAngle = Math.atan2(this.facing.x, this.facing.z)
      this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, targetAngle, dt * 10)
    }

    if (input.jump && this.grounded) {
      this.velocityY = JUMP_SPEED
      this.grounded = false
    }

    this.velocityY += GRAVITY * dt
    this.mesh.position.y += this.velocityY * dt
    if (this.mesh.position.y <= 0) {
      this.mesh.position.y = 0
      this.velocityY = 0
      this.grounded = true
    }
  }
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2)
  if (diff > Math.PI) diff -= Math.PI * 2
  if (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * Math.min(t, 1)
}
