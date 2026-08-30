import * as THREE from 'three'

interface Burst {
  points: THREE.Points
  velocities: Float32Array
  life: number
  maxLife: number
}

const PARTICLES_PER_BURST = 16

/** 동물/아이템 획득 시 터지는 파티클 이펙트 */
export class EffectsManager {
  private bursts: Burst[] = []

  constructor(private scene: THREE.Scene) {}

  burst(position: THREE.Vector3, color: number): void {
    const positions = new Float32Array(PARTICLES_PER_BURST * 3)
    const velocities = new Float32Array(PARTICLES_PER_BURST * 3)

    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y + 0.6
      positions[i * 3 + 2] = position.z

      const angle = Math.random() * Math.PI * 2
      const upSpeed = 1.5 + Math.random() * 2.2
      const outSpeed = 0.6 + Math.random() * 1.6
      velocities[i * 3] = Math.cos(angle) * outSpeed
      velocities[i * 3 + 1] = upSpeed
      velocities[i * 3 + 2] = Math.sin(angle) * outSpeed
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const material = new THREE.PointsMaterial({
      color,
      size: 0.22,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    this.scene.add(points)

    this.bursts.push({ points, velocities, life: 0.7, maxLife: 0.7 })
  }

  update(dt: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]!
      b.life -= dt
      if (b.life <= 0) {
        this.scene.remove(b.points)
        b.points.geometry.dispose()
        ;(b.points.material as THREE.Material).dispose()
        this.bursts.splice(i, 1)
        continue
      }
      const posAttr = b.points.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let p = 0; p < PARTICLES_PER_BURST; p++) {
        posAttr.array[p * 3] += b.velocities[p * 3]! * dt
        posAttr.array[p * 3 + 1] += (b.velocities[p * 3 + 1]! - 3.2 * (1 - b.life / b.maxLife)) * dt
        posAttr.array[p * 3 + 2] += b.velocities[p * 3 + 2]! * dt
      }
      posAttr.needsUpdate = true
      ;(b.points.material as THREE.PointsMaterial).opacity = b.life / b.maxLife
    }
  }
}
