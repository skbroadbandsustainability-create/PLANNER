import * as THREE from 'three'
import type { Animal } from '../world/Animal.ts'

interface RopeEntry {
  animal: Animal
  line: THREE.Line
}

const CATCH_UP_EXTRA_SPEED = 2.6

/** 마우스 클릭으로 던지는 밧줄(올가미) - 동물을 포획해서 플레이어를 따라오게 만든다 */
export class RopeController {
  private entries: RopeEntry[] = []
  private lineMaterial = new THREE.LineBasicMaterial({ color: 0x7a5233, linewidth: 2 })

  constructor(private scene: THREE.Scene) {}

  get count(): number {
    return this.entries.length
  }

  isRoped(animal: Animal): boolean {
    return this.entries.some((e) => e.animal === animal)
  }

  attach(animal: Animal): void {
    animal.state = 'roped'
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const line = new THREE.Line(geometry, this.lineMaterial)
    line.frustumCulled = false
    this.scene.add(line)
    this.entries.push({ animal, line })
  }

  releaseAll(): void {
    for (const e of this.entries) {
      if (e.animal.state === 'roped') e.animal.state = 'wild'
      this.scene.remove(e.line)
      e.line.geometry.dispose()
    }
    this.entries = []
  }

  private releaseEntry(entry: RopeEntry, keepState: 'wild' | 'penned'): void {
    entry.animal.state = keepState
    this.scene.remove(entry.line)
    entry.line.geometry.dispose()
    this.entries = this.entries.filter((e) => e !== entry)
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerFacing: THREE.Vector3,
    dragSpeed: number,
    penCenter: THREE.Vector3,
    penRadius: number,
    onDeliver: (animal: Animal) => void,
  ): void {
    const behind = new THREE.Vector3(-playerFacing.x, 0, -playerFacing.z)
    if (behind.lengthSq() < 0.0001) behind.set(0, 0, 1)
    behind.normalize()
    const side = new THREE.Vector3(-behind.z, 0, behind.x)

    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!
      const leashDist = 1.7 + i * 1.0
      const sideOffset = i % 2 === 0 ? 0.6 : -0.6
      const target = new THREE.Vector3()
        .copy(playerPos)
        .addScaledVector(behind, leashDist)
        .addScaledVector(side, sideOffset)

      const toTarget = new THREE.Vector3().subVectors(target, entry.animal.position)
      const dist = toTarget.length()
      if (dist > 0.05) {
        toTarget.normalize()
        // 목표 지점(플레이어 뒤)이 계속 움직이므로, 뒤처질수록 따라잡는 속도가 비례해서 커지도록 한다.
        // (그렇지 않으면 플레이어 이동 속도가 dragSpeed보다 빠를 때 동물이 영영 못 따라잡는다)
        const speed = dragSpeed + Math.max(0, dist - leashDist) * CATCH_UP_EXTRA_SPEED
        const step = Math.min(dist, speed * dt)
        entry.animal.position.addScaledVector(toTarget, step)
        const angle = Math.atan2(toTarget.x, toTarget.z)
        entry.animal.mesh.rotation.y = angle
      }
      entry.animal.mesh.position.y = 0

      this.updateRopeLine(entry, playerPos)

      const flatDist = Math.hypot(
        entry.animal.position.x - penCenter.x,
        entry.animal.position.z - penCenter.z,
      )
      if (flatDist < penRadius) {
        this.releaseEntry(entry, 'penned')
        onDeliver(entry.animal)
      }
    }
  }

  private updateRopeLine(entry: RopeEntry, playerPos: THREE.Vector3): void {
    const start = new THREE.Vector3(playerPos.x, 1.1, playerPos.z)
    const end = new THREE.Vector3(entry.animal.position.x, 0.3, entry.animal.position.z)
    const mid = start.clone().lerp(end, 0.5)
    mid.y = Math.max(0.15, Math.min(start.y, end.y) - 0.4)
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const pts = curve.getPoints(10)
    entry.line.geometry.dispose()
    entry.line.geometry = new THREE.BufferGeometry().setFromPoints(pts)
  }
}
