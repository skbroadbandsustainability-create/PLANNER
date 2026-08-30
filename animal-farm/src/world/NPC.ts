import * as THREE from 'three'
import { buildHumanoidMesh } from './meshFactory.ts'

/** 농장 옆 사료 가게를 운영하는 NPC - 동물 먹이 가게 아저씨 */
export class NPC {
  readonly name = '사료 가게 아저씨'
  readonly mesh: THREE.Group
  readonly interactRadius = 2.6

  constructor(position: THREE.Vector3) {
    this.mesh = buildHumanoidMesh({ shirt: 0x4a7fc9, pants: 0x5a4632, skin: 0xe8b98a, hat: 0x8a5a2e })
    this.mesh.position.copy(position)
    this.mesh.rotation.y = Math.PI

    // 상점 좌판 (전부 각진 블록으로 구성)
    const stallGroup = new THREE.Group()
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.55, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x8a6339, flatShading: true, roughness: 1 }),
    )
    table.position.set(0, 0.275, -0.9)
    stallGroup.add(table)

    const roofPole = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x6b4a26, flatShading: true, roughness: 1 }),
    )
    roofPole.position.set(0, 0.8, -0.9)
    stallGroup.add(roofPole)

    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd94f3d, flatShading: true, roughness: 1 })
    const roofBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.5), roofMat)
    roofBase.position.set(0, 1.5, -0.9)
    stallGroup.add(roofBase)
    const roofTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.9), roofMat)
    roofTop.position.set(0, 1.74, -0.9)
    stallGroup.add(roofTop)

    // 사료 자루
    const sackMat = new THREE.MeshStandardMaterial({ color: 0xd9c27a, flatShading: true, roughness: 1 })
    for (const dx of [-0.4, 0.4]) {
      const sack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), sackMat)
      sack.position.set(dx, 0.55 + 0.21, -0.9)
      stallGroup.add(sack)
    }

    this.mesh.add(stallGroup)
  }

  distanceTo(pos: THREE.Vector3): number {
    return this.mesh.position.distanceTo(pos)
  }
}
