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

function castShadows(group: THREE.Group): THREE.Group {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true
  })
  return group
}

/** 종 정의로부터 저해상도(로우폴리) 동물 메시를 절차적으로 생성한다. 체형별로 전용 빌더에 위임한다. */
export function buildCritterMesh(species: SpeciesDef): THREE.Group {
  switch (species.bodyShape) {
    case 'shell':
      return castShadows(buildShellCreature(species))
    case 'clamshell':
      return castShadows(buildClam(species))
    case 'starfish':
      return castShadows(buildStarfish(species))
    case 'octopus':
      return castShadows(buildOctopus(species))
    case 'fish':
      return castShadows(buildFish(species))
    case 'serpent':
      return castShadows(buildSerpent(species))
    case 'insect':
      return castShadows(buildInsect(species))
    default:
      return castShadows(buildLandCreature(species))
  }
}

// ---------------------------------------------------------------------------
// 사족보행 / 이족보행 / 납작한(게) 몸통 - 대부분의 육상·조류 종이 여기 해당
// ---------------------------------------------------------------------------
function buildLandCreature(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)
  const flat = species.bodyShape === 'flat'

  const legLen = species.legCount > 0 ? 0.35 * s : 0
  const bodyRadius = 0.45 * s

  // 몸통
  let body: THREE.Mesh
  if (flat) {
    body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.22 * s, 1.0 * s), bodyMat)
    body.position.y = 0.14 * s
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius, 8, 6), bodyMat)
    body.scale.set(1, 0.8, 1.35)
    body.position.y = legLen + bodyRadius * 0.75
  }
  group.add(body)

  // 목 (목이 긴 종: 왜가리 등)
  const headRadius = 0.28 * s
  let neckTopY = body.position.y + bodyRadius * 0.55
  if (species.hasLongNeck) {
    const neckHeight = 0.65 * s
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.09 * s, neckHeight, 6), bodyMat)
    neck.position.set(0, body.position.y + bodyRadius * 0.3 + neckHeight / 2, body.position.z + bodyRadius * 0.3)
    group.add(neck)
    neckTopY = neck.position.y + neckHeight / 2
  }

  const headY = neckTopY + (species.hasLongNeck ? headRadius * 0.6 : 0)
  const headZ = body.position.z + (flat ? 0.32 * s : species.hasLongNeck ? 0.32 * s : 0.42 * s)
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 8, 6), bodyMat)
  head.position.set(0, flat ? body.position.y + 0.08 * s : headY, headZ)
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

  // 뿔 (straight: 염소/소/산양 스타일, antler: 사슴의 갈라진 뿔)
  if (species.hasHorns) {
    for (const side of [-1, 1]) {
      const hornBase = new THREE.Vector3(
        side * headRadius * 0.5,
        head.position.y + headRadius * 0.9,
        head.position.z - headRadius * 0.2,
      )
      if (species.hornStyle === 'antler') {
        const main = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.38 * s, 5), darkMat)
        main.position.copy(hornBase).add(new THREE.Vector3(0, 0.19 * s, 0))
        main.rotation.z = side * 0.15
        group.add(main)
        for (const prong of [0.12, 0.24]) {
          const branch = new THREE.Mesh(new THREE.ConeGeometry(0.025 * s, 0.16 * s, 5), darkMat)
          branch.position.copy(hornBase).add(new THREE.Vector3(side * 0.08 * s, prong * s + 0.05, 0))
          branch.rotation.z = side * 0.7
          group.add(branch)
        }
      } else {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.3 * s, 6), darkMat)
        horn.position.copy(hornBase)
        horn.rotation.x = -0.4
        horn.rotation.z = side * 0.3
        group.add(horn)
      }
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
  if (flat) {
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
  } else if (flat) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 0, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.03 * s, 0.14 * s, 4), bodyMat)
        leg.position.set(sx * 0.42 * s, 0.07 * s, sz * 0.3 * s)
        leg.rotation.z = sx * 0.5
        group.add(leg)
      }
    }
  } else {
    // 다리가 없는 종 (물범 등): 지느러미
    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.06 * s, 0.35 * s), accentMat)
      flipper.position.set(side * bodyRadius * 0.9, body.position.y - bodyRadius * 0.3, body.position.z)
      group.add(flipper)
    }
    body.position.y = bodyRadius * 0.6
    head.position.y = body.position.y + bodyRadius * 0.4
  }

  // 날개 (조류)
  if (species.wingType !== 'none') {
    const wingLen = (species.wingType === 'large' ? 0.55 : 0.32) * s
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, wingLen, 4), accentMat)
      wing.position.set(side * bodyRadius * 0.85, body.position.y, body.position.z - 0.05 * s)
      wing.rotation.z = side * 1.35
      wing.rotation.y = 0.2
      wing.scale.set(1, 1, 0.35)
      group.add(wing)
    }
  }

  // 꼬리
  addTail(group, species, body, bodyMat, accentMat, bodyRadius)

  return group
}

function addTail(
  group: THREE.Group,
  species: SpeciesDef,
  body: THREE.Mesh,
  bodyMat: THREE.Material,
  accentMat: THREE.Material,
  bodyRadius: number,
): void {
  const s = species.scale
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
  } else if (species.tailType === 'paddle') {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.05 * s, 0.3 * s), accentMat)
    tail.position.set(0, body.position.y - 0.05 * s, body.position.z - bodyRadius * 1.15)
    group.add(tail)
  } else if (species.tailType === 'fan') {
    for (const angle of [-0.5, -0.17, 0.17, 0.5]) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.4 * s, 4), accentMat)
      blade.scale.set(1, 1, 0.3)
      blade.position.set(0, body.position.y + 0.05 * s, body.position.z - bodyRadius)
      blade.rotation.x = Math.PI / 2 + 0.5
      blade.rotation.z = angle
      group.add(blade)
    }
  }
}

// ---------------------------------------------------------------------------
// 껍데기가 있는 종 (거북이/자라): 반구형 등딱지 + 작은 머리와 다리
// ---------------------------------------------------------------------------
function buildShellCreature(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 1.8), accentMat)
  shell.position.y = 0.28 * s
  group.add(shell)

  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.1 * s, 8), bodyMat)
  belly.position.y = 0.2 * s
  group.add(belly)

  const headRadius = 0.16 * s
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 8, 6), bodyMat)
  head.position.set(0, 0.24 * s, 0.42 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.18, 6, 6), darkMat)
    eye.position.set(side * headRadius * 0.5, head.position.y + headRadius * 0.2, head.position.z + headRadius * 0.7)
    group.add(eye)
  }

  if (species.legCount === 0) {
    // 지느러미 (바다거북)
    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.05 * s, 0.34 * s), bodyMat)
      flipper.position.set(side * 0.4 * s, 0.16 * s, 0.05 * s)
      flipper.rotation.y = side * 0.3
      group.add(flipper)
    }
  } else {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.16 * s, 5), bodyMat)
        leg.position.set(sx * 0.32 * s, 0.1 * s, sz * 0.28 * s)
        group.add(leg)
      }
    }
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06 * s, 0.16 * s, 5), bodyMat)
  tail.rotation.x = Math.PI / 2 + 0.3
  tail.position.set(0, 0.2 * s, -0.42 * s)
  group.add(tail)

  return group
}

// ---------------------------------------------------------------------------
// 조개: 위아래로 살짝 벌어진 두 개의 반구 껍데기
// ---------------------------------------------------------------------------
function buildClam(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const shellMat = mat(species.accentColor)
  const innerMat = mat(species.bodyColor)

  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 8, 6), innerMat)
  inner.scale.set(1, 0.5, 1)
  inner.position.y = 0.12 * s
  group.add(inner)

  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.35 * s, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    shellMat,
  )
  bottom.position.y = 0.05 * s
  group.add(bottom)

  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.35 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.4),
    shellMat,
  )
  top.position.y = 0.2 * s
  top.rotation.x = Math.PI
  top.rotation.z = 0.35
  group.add(top)

  return group
}

// ---------------------------------------------------------------------------
// 불가사리: 중심 원반에서 뻗어나가는 5개의 납작한 팔
// ---------------------------------------------------------------------------
function buildStarfish(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)

  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.16 * s, 0.08 * s, 8), accentMat)
  center.position.y = 0.06 * s
  group.add(center)

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const arm = new THREE.Mesh(new THREE.ConeGeometry(0.11 * s, 0.5 * s, 4), bodyMat)
    arm.scale.set(1, 1, 0.25)
    arm.position.set(Math.cos(angle) * 0.28 * s, 0.05 * s, Math.sin(angle) * 0.28 * s)
    arm.rotation.x = Math.PI / 2
    arm.rotation.z = -angle
    group.add(arm)
  }

  return group
}

// ---------------------------------------------------------------------------
// 문어: 둥근 머리(외투막) + 8개의 얇은 다리
// ---------------------------------------------------------------------------
function buildOctopus(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 8, 8), bodyMat)
  mantle.position.y = 0.42 * s
  group.add(mantle)

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 6), darkMat)
    eye.position.set(side * 0.14 * s, 0.46 * s, 0.26 * s)
    group.add(eye)
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.ConeGeometry(0.045 * s, 0.4 * s, 5), accentMat)
    leg.position.set(Math.cos(angle) * 0.16 * s, 0.2 * s, Math.sin(angle) * 0.16 * s)
    leg.rotation.x = Math.PI + 0.4
    leg.rotation.z = angle
    group.add(leg)
  }

  return group
}

// ---------------------------------------------------------------------------
// 물고기 (잉어/송어): 좌우로 납작한 유선형 몸통 + 꼬리지느러미
// ---------------------------------------------------------------------------
function buildFish(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 8, 6), bodyMat)
  body.scale.set(1.4, 0.85, 0.55)
  body.position.y = 0.2 * s
  group.add(body)

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 6, 6), darkMat)
  eye.position.set(0.36 * s, 0.24 * s, 0)
  group.add(eye)

  const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.26 * s, 4), accentMat)
  tailFin.scale.set(1, 1, 0.2)
  tailFin.rotation.z = Math.PI / 2
  tailFin.position.set(-0.38 * s, 0.2 * s, 0)
  group.add(tailFin)

  const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.18 * s, 4), accentMat)
  dorsalFin.scale.set(1, 1, 0.2)
  dorsalFin.position.set(0, 0.38 * s, 0)
  group.add(dorsalFin)

  for (const side of [-1, 1]) {
    const sideFin = new THREE.Mesh(new THREE.ConeGeometry(0.07 * s, 0.14 * s, 4), accentMat)
    sideFin.scale.set(1, 1, 0.2)
    sideFin.rotation.z = side * 1.1
    sideFin.position.set(0.1 * s, 0.12 * s, side * 0.1 * s)
    group.add(sideFin)
  }

  return group
}

// ---------------------------------------------------------------------------
// 뱀: 점점 가늘어지는 구슬을 이어 붙인 몸통
// ---------------------------------------------------------------------------
function buildSerpent(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const segmentCount = 6
  for (let i = 0; i < segmentCount; i++) {
    const t = i / (segmentCount - 1)
    const radius = 0.16 * s * (1 - t * 0.55)
    const seg = new THREE.Mesh(new THREE.SphereGeometry(radius, 6, 5), bodyMat)
    seg.position.set(Math.sin(t * Math.PI * 1.4) * 0.16 * s, radius * 0.9, 0.4 * s - t * 0.8 * s)
    group.add(seg)
  }

  const headRadius = 0.17 * s
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 8, 6), bodyMat)
  head.position.set(0, headRadius * 0.9, 0.42 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.2, 6, 6), darkMat)
    eye.position.set(side * headRadius * 0.5, head.position.y + headRadius * 0.3, head.position.z + headRadius * 0.7)
    group.add(eye)
  }
  const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.015 * s, 0.14 * s, 3), accentMat)
  tongue.rotation.x = Math.PI / 2
  tongue.position.set(0, headRadius * 0.7, head.position.z + headRadius * 0.9)
  group.add(tongue)

  return group
}

// ---------------------------------------------------------------------------
// 곤충 (잠자리): 가느다란 몸통 + 두 쌍의 얇은 날개
// ---------------------------------------------------------------------------
function buildInsect(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const wingMat = new THREE.MeshStandardMaterial({
    color: species.accentColor,
    flatShading: true,
    transparent: true,
    opacity: 0.55,
  })
  const darkMat = mat(0x2b2b2b)

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * s, 0.5 * s, 2, 6), bodyMat)
  body.rotation.x = Math.PI / 2
  body.position.y = 0.3 * s
  group.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 8, 6), bodyMat)
  head.position.set(0, 0.3 * s, 0.3 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 6), darkMat)
    eye.position.set(side * 0.05 * s, 0.32 * s, 0.35 * s)
    group.add(eye)
  }

  for (const side of [-1, 1]) {
    for (const wingZ of [0.08, -0.1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * s, 0.14 * s), wingMat)
      wing.position.set(side * 0.28 * s, 0.34 * s, wingZ * s)
      wing.rotation.y = side * 0.3
      wing.material.side = THREE.DoubleSide
      group.add(wing)
    }
  }

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
