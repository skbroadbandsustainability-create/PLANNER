import * as THREE from 'three'
import type { SpeciesDef } from '../core/types.ts'

const materialCache = new Map<number, THREE.MeshStandardMaterial>()

/** 색상별로 재질을 캐싱해서 동물이 많아져도 재질 개수를 낮게 유지한다. */
function mat(color: number): THREE.MeshStandardMaterial {
  let m = materialCache.get(color)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85 })
    materialCache.set(color, m)
  }
  return m
}

/** 저해상도(로우폴리) 동물 메시를 종 정의로부터 절차적으로 생성한다. */
export function buildCritterMesh(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const legLen = species.legCount > 0 ? 0.35 * s : 0
  const bodyRadius = 0.45 * s

  // 몸통
  let body: THREE.Mesh
  if (species.flat) {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.22 * s, 1.0 * s), bodyMat)
    body.position.y = 0.14 * s
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius, 8, 6), bodyMat)
    body.scale.set(1, 0.8, 1.35)
    body.position.y = legLen + bodyRadius * 0.75
  }
  body.castShadow = true
  group.add(body)

  const headY = body.position.y + bodyRadius * 0.55
  const headZ = body.position.z + (species.flat ? 0.32 * s : 0.42 * s)
  const headRadius = 0.28 * s
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 8, 6), bodyMat)
  head.position.set(0, species.flat ? body.position.y + 0.08 * s : headY, headZ)
  head.castShadow = true
  group.add(head)

  // 눈
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.16, 6, 6), darkMat)
    eye.position.set(side * headRadius * 0.55, head.position.y + headRadius * 0.1, head.position.z + headRadius * 0.75)
    group.add(eye)
  }

  // 귀
  if (species.earType === 'long') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.55 * s, 6), accentMat)
      ear.position.set(side * headRadius * 0.5, head.position.y + headRadius * 0.9, head.position.z - headRadius * 0.1)
      ear.rotation.z = side * 0.15
      group.add(ear)
    }
  } else if (species.earType === 'short') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.18 * s, 6), bodyMat)
      ear.position.set(side * headRadius * 0.7, head.position.y + headRadius * 0.75, head.position.z)
      group.add(ear)
    }
  } else if (species.earType === 'floppy') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.32 * s, 0.06 * s), accentMat)
      ear.position.set(side * headRadius * 0.9, head.position.y + headRadius * 0.1, head.position.z)
      ear.rotation.z = side * 0.5
      group.add(ear)
    }
  }

  // 뿔
  if (species.hasHorns) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.3 * s, 6), darkMat)
      horn.position.set(side * headRadius * 0.5, head.position.y + headRadius * 0.9, head.position.z - headRadius * 0.2)
      horn.rotation.x = -0.4
      horn.rotation.z = side * 0.3
      group.add(horn)
    }
  }

  // 부리
  if (species.hasBeak) {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.22 * s, 6), accentMat)
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, head.position.y - headRadius * 0.1, head.position.z + headRadius * 0.9)
    group.add(beak)
  }

  // 집게발 (게)
  if (species.flat) {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.28 * s, 6), accentMat)
      claw.rotation.x = Math.PI / 2
      claw.position.set(side * 0.45 * s, body.position.y, body.position.z + 0.4 * s)
      group.add(claw)
    }
  }

  // 다리
  if (species.legCount === 4) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, legLen, 5), bodyMat)
        leg.position.set(sx * bodyRadius * 0.55, legLen / 2, sz * bodyRadius * 0.65 + body.position.z)
        group.add(leg)
      }
    }
  } else if (species.legCount === 2) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, legLen, 5), accentMat)
      leg.position.set(sx * bodyRadius * 0.35, legLen / 2, body.position.z)
      group.add(leg)
    }
  } else if (species.flat) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 0, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.14 * s, 4), bodyMat)
        leg.position.set(sx * 0.42 * s, 0.07 * s, sz * 0.3 * s)
        leg.rotation.z = sx * 0.5
        group.add(leg)
      }
    }
  } else {
    // 다리가 없는 종 (물범): 지느러미
    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.06 * s, 0.35 * s), accentMat)
      flipper.position.set(side * bodyRadius * 0.9, body.position.y - bodyRadius * 0.3, body.position.z)
      group.add(flipper)
    }
    body.position.y = bodyRadius * 0.6
    head.position.y = body.position.y + bodyRadius * 0.4
  }

  // 꼬리
  if (species.tailType === 'fluffy') {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 6, 6), bodyMat)
    tail.position.set(0, body.position.y, body.position.z - bodyRadius * 1.1)
    group.add(tail)
  } else if (species.tailType === 'thin') {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.35 * s, 5), accentMat)
    tail.rotation.x = Math.PI / 2 + 0.3
    tail.position.set(0, body.position.y, body.position.z - bodyRadius)
    group.add(tail)
  } else if (species.tailType === 'stub') {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 6, 6), bodyMat)
    tail.position.set(0, body.position.y, body.position.z - bodyRadius * 1.05)
    group.add(tail)
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true
  })

  return group
}

/** 플레이어/NPC 등 사람 캐릭터의 저해상도 메시를 만든다. */
export function buildHumanoidMesh(opts: {
  shirt: number
  pants: number
  skin: number
  hat?: number
}): THREE.Group {
  const group = new THREE.Group()
  const skinMat = mat(opts.skin)
  const shirtMat = mat(opts.shirt)
  const pantsMat = mat(opts.pants)

  const legLen = 0.55
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, legLen, 6), pantsMat)
    leg.position.set(side * 0.14, legLen / 2, 0)
    leg.castShadow = true
    group.add(leg)
  }

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.3), shirtMat)
  torso.position.y = legLen + 0.275
  torso.castShadow = true
  group.add(torso)

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), shirtMat)
    arm.position.set(side * 0.32, legLen + 0.28, 0)
    arm.castShadow = true
    group.add(arm)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), skinMat)
    hand.position.set(side * 0.32, legLen + 0.02, 0)
    group.add(hand)
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat)
  head.position.y = legLen + 0.55 + 0.32
  head.castShadow = true
  group.add(head)

  if (opts.hat !== undefined) {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.28, 8), mat(opts.hat))
    hat.position.y = head.position.y + 0.28
    group.add(hat)
  }

  return group
}
