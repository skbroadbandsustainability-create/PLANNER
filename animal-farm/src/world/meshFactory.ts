import * as THREE from 'three'
import type { SpeciesDef } from '../core/types.ts'

const materialCache = new Map<number, THREE.MeshStandardMaterial>()

/** 색상별로 재질을 캐싱해서 동물이 많아져도 재질 개수를 낮게 유지한다. */
function mat(color: number): THREE.MeshStandardMaterial {
  let m = materialCache.get(color)
  if (!m) {
    // roughness 1(완전 무광) + flatShading로 마인크래프트 블록 특유의 각지고 반질거리지 않는 느낌을 낸다.
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 })
    materialCache.set(color, m)
  }
  return m
}

/** 짧게 쓰기 위한 BoxGeometry 헬퍼. 모든 파츠가 블록(직육면체)으로만 이루어진다. */
function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d)
}

function castShadows(group: THREE.Group): THREE.Group {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true
  })
  return group
}

/** 종 정의로부터 블록(마인크래프트풍) 동물 메시를 절차적으로 생성한다. 체형별로 전용 빌더에 위임한다. */
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

  const legLen = species.legCount > 0 ? 0.34 * s : 0
  const bodyW = 0.56 * s
  const bodyH = flat ? 0.22 * s : 0.44 * s
  const bodyD = flat ? 0.85 * s : 0.78 * s

  // 몸통
  const body = new THREE.Mesh(box(bodyW, bodyH, bodyD), bodyMat)
  body.position.y = flat ? 0.14 * s : legLen + bodyH / 2
  group.add(body)

  // 목 (목이 긴 종: 왜가리 등)
  const headSize = 0.34 * s
  let neckTopY = body.position.y + bodyH * 0.4
  if (species.hasLongNeck) {
    const neckHeight = 0.6 * s
    const neck = new THREE.Mesh(box(0.16 * s, neckHeight, 0.16 * s), bodyMat)
    neck.position.set(0, body.position.y + bodyH / 2 + neckHeight / 2 - 0.05 * s, body.position.z + bodyD * 0.32)
    group.add(neck)
    neckTopY = neck.position.y + neckHeight / 2
  }

  const headY = species.hasLongNeck ? neckTopY + headSize * 0.4 : neckTopY
  const headZ = body.position.z + (flat ? 0.32 * s : species.hasLongNeck ? 0.1 * s : bodyD * 0.42)
  const head = new THREE.Mesh(box(headSize, headSize, headSize), bodyMat)
  head.position.set(0, flat ? body.position.y + 0.1 * s : headY, headZ)
  group.add(head)

  // 눈
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(box(0.05 * s, 0.05 * s, 0.02 * s), darkMat)
    eye.position.set(side * headSize * 0.28, head.position.y + headSize * 0.08, head.position.z + headSize * 0.51)
    group.add(eye)
  }

  // 귀
  if (species.earType === 'long') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(box(0.09 * s, 0.4 * s, 0.07 * s), accentMat)
      ear.position.set(side * headSize * 0.3, head.position.y + headSize * 0.5 + 0.18 * s, head.position.z - headSize * 0.1)
      ear.rotation.z = side * 0.12
      group.add(ear)
    }
  } else if (species.earType === 'short') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(box(0.13 * s, 0.13 * s, 0.07 * s), bodyMat)
      ear.position.set(side * headSize * 0.45, head.position.y + headSize * 0.55, head.position.z)
      group.add(ear)
    }
  } else if (species.earType === 'floppy') {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(box(0.1 * s, 0.32 * s, 0.06 * s), accentMat)
      ear.position.set(side * headSize * 0.55, head.position.y + headSize * 0.05, head.position.z)
      ear.rotation.z = side * 0.45
      group.add(ear)
    }
  }

  // 뿔 (straight: 염소/소/산양 스타일, antler: 사슴의 갈라진 뿔) - 모두 각진 막대(블록)로 표현
  if (species.hasHorns) {
    for (const side of [-1, 1]) {
      const hornBase = new THREE.Vector3(
        side * headSize * 0.3,
        head.position.y + headSize * 0.55,
        head.position.z - headSize * 0.25,
      )
      if (species.hornStyle === 'antler') {
        const main = new THREE.Mesh(box(0.05 * s, 0.36 * s, 0.05 * s), darkMat)
        main.position.copy(hornBase).add(new THREE.Vector3(0, 0.18 * s, 0))
        main.rotation.z = side * 0.2
        group.add(main)
        for (const prong of [0.1, 0.22]) {
          const branch = new THREE.Mesh(box(0.04 * s, 0.16 * s, 0.04 * s), darkMat)
          branch.position.copy(hornBase).add(new THREE.Vector3(side * 0.09 * s, prong * s + 0.05, 0))
          branch.rotation.z = side * 0.9
          group.add(branch)
        }
      } else {
        const horn = new THREE.Mesh(box(0.06 * s, 0.28 * s, 0.06 * s), darkMat)
        horn.position.copy(hornBase)
        horn.rotation.x = -0.35
        horn.rotation.z = side * 0.25
        group.add(horn)
      }
    }
  }

  // 부리
  if (species.hasBeak) {
    const beak = new THREE.Mesh(box(0.12 * s, 0.09 * s, 0.18 * s), accentMat)
    beak.position.set(0, head.position.y - headSize * 0.12, head.position.z + headSize * 0.55)
    group.add(beak)
  }

  // 집게발 (게)
  if (flat) {
    for (const side of [-1, 1]) {
      const claw = new THREE.Mesh(box(0.16 * s, 0.12 * s, 0.24 * s), accentMat)
      claw.position.set(side * 0.46 * s, body.position.y, body.position.z + bodyD * 0.45)
      group.add(claw)
    }
  }

  // 다리
  if (species.legCount === 4) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(box(0.1 * s, legLen, 0.1 * s), bodyMat)
        leg.position.set(sx * bodyW * 0.38, legLen / 2, sz * bodyD * 0.3 + body.position.z)
        group.add(leg)
      }
    }
  } else if (species.legCount === 2) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(box(0.08 * s, legLen, 0.08 * s), accentMat)
      leg.position.set(sx * bodyW * 0.22, legLen / 2, body.position.z)
      group.add(leg)
    }
  } else if (flat) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 0, 1]) {
        const leg = new THREE.Mesh(box(0.04 * s, 0.14 * s, 0.05 * s), bodyMat)
        leg.position.set(sx * 0.44 * s, 0.07 * s, sz * 0.3 * s)
        leg.rotation.z = sx * 0.4
        group.add(leg)
      }
    }
  } else {
    // 다리가 없는 종 (물범 등): 지느러미
    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(box(0.14 * s, 0.08 * s, 0.36 * s), accentMat)
      flipper.position.set(side * bodyW * 0.6, body.position.y - bodyH * 0.25, body.position.z)
      group.add(flipper)
    }
    body.position.y = bodyH * 0.55
    head.position.y = body.position.y + bodyH * 0.25
  }

  // 날개 (조류) - 옆으로 붙는 납작한 블록
  if (species.wingType !== 'none') {
    const wingLen = (species.wingType === 'large' ? 0.6 : 0.34) * s
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(box(0.12 * s, 0.08 * s, wingLen), accentMat)
      wing.position.set(side * (bodyW / 2 + 0.05 * s), body.position.y, body.position.z - 0.05 * s)
      wing.rotation.y = side * 0.3
      group.add(wing)
    }
  }

  // 꼬리
  addTail(group, species, body, bodyMat, accentMat, bodyD)

  return group
}

function addTail(
  group: THREE.Group,
  species: SpeciesDef,
  body: THREE.Mesh,
  bodyMat: THREE.Material,
  accentMat: THREE.Material,
  bodyD: number,
): void {
  const s = species.scale
  const backZ = body.position.z - bodyD / 2
  if (species.tailType === 'fluffy') {
    const tail = new THREE.Mesh(box(0.26 * s, 0.26 * s, 0.22 * s), bodyMat)
    tail.position.set(0, body.position.y, backZ - 0.05 * s)
    group.add(tail)
  } else if (species.tailType === 'thin') {
    const tail = new THREE.Mesh(box(0.06 * s, 0.06 * s, 0.34 * s), accentMat)
    tail.rotation.x = 0.4
    tail.position.set(0, body.position.y + 0.05 * s, backZ - 0.1 * s)
    group.add(tail)
  } else if (species.tailType === 'stub') {
    const tail = new THREE.Mesh(box(0.14 * s, 0.14 * s, 0.14 * s), bodyMat)
    tail.position.set(0, body.position.y, backZ - 0.02 * s)
    group.add(tail)
  } else if (species.tailType === 'paddle') {
    const tail = new THREE.Mesh(box(0.26 * s, 0.05 * s, 0.3 * s), accentMat)
    tail.position.set(0, body.position.y - 0.05 * s, backZ - 0.12 * s)
    group.add(tail)
  } else if (species.tailType === 'fan') {
    for (const angle of [-0.5, -0.17, 0.17, 0.5]) {
      const blade = new THREE.Mesh(box(0.05 * s, 0.34 * s, 0.02 * s), accentMat)
      blade.position.set(0, body.position.y + 0.08 * s, backZ - 0.02 * s)
      blade.rotation.x = 0.6
      blade.rotation.z = angle
      group.add(blade)
    }
  }
}

// ---------------------------------------------------------------------------
// 껍데기가 있는 종 (거북이/자라): 각진 등딱지 블록 + 작은 머리와 다리
// ---------------------------------------------------------------------------
function buildShellCreature(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const shell = new THREE.Mesh(box(0.78 * s, 0.3 * s, 0.86 * s), accentMat)
  shell.position.y = 0.32 * s
  group.add(shell)

  const belly = new THREE.Mesh(box(0.68 * s, 0.1 * s, 0.76 * s), bodyMat)
  belly.position.y = 0.17 * s
  group.add(belly)

  const headSize = 0.24 * s
  const head = new THREE.Mesh(box(headSize, headSize, headSize), bodyMat)
  head.position.set(0, 0.24 * s, 0.44 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(box(0.04 * s, 0.04 * s, 0.02 * s), darkMat)
    eye.position.set(side * headSize * 0.3, head.position.y + headSize * 0.15, head.position.z + headSize * 0.51)
    group.add(eye)
  }

  if (species.legCount === 0) {
    // 지느러미 (바다거북)
    for (const side of [-1, 1]) {
      const flipper = new THREE.Mesh(box(0.14 * s, 0.06 * s, 0.36 * s), bodyMat)
      flipper.position.set(side * 0.42 * s, 0.16 * s, 0.05 * s)
      flipper.rotation.y = side * 0.25
      group.add(flipper)
    }
  } else {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(box(0.1 * s, 0.16 * s, 0.1 * s), bodyMat)
        leg.position.set(sx * 0.32 * s, 0.08 * s, sz * 0.3 * s)
        group.add(leg)
      }
    }
  }

  const tail = new THREE.Mesh(box(0.1 * s, 0.09 * s, 0.16 * s), bodyMat)
  tail.position.set(0, 0.2 * s, -0.46 * s)
  group.add(tail)

  return group
}

// ---------------------------------------------------------------------------
// 조개: 위아래로 살짝 벌어진 두 개의 각진 껍데기
// ---------------------------------------------------------------------------
function buildClam(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const shellMat = mat(species.accentColor)
  const innerMat = mat(species.bodyColor)

  const inner = new THREE.Mesh(box(0.5 * s, 0.14 * s, 0.5 * s), innerMat)
  inner.position.y = 0.12 * s
  group.add(inner)

  const bottom = new THREE.Mesh(box(0.6 * s, 0.16 * s, 0.6 * s), shellMat)
  bottom.position.y = 0.06 * s
  group.add(bottom)

  const top = new THREE.Mesh(box(0.56 * s, 0.16 * s, 0.56 * s), shellMat)
  top.position.set(0, 0.22 * s, -0.06 * s)
  top.rotation.x = -0.4
  group.add(top)

  return group
}

// ---------------------------------------------------------------------------
// 불가사리: 중심 블록에서 뻗어나가는 5개의 납작한 팔
// ---------------------------------------------------------------------------
function buildStarfish(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)

  const center = new THREE.Mesh(box(0.22 * s, 0.08 * s, 0.22 * s), accentMat)
  center.position.y = 0.05 * s
  group.add(center)

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2
    const arm = new THREE.Mesh(box(0.13 * s, 0.06 * s, 0.42 * s), bodyMat)
    arm.position.set(Math.cos(angle) * 0.24 * s, 0.05 * s, Math.sin(angle) * 0.24 * s)
    arm.rotation.y = -angle
    group.add(arm)
  }

  return group
}

// ---------------------------------------------------------------------------
// 문어: 각진 머리(외투막) 블록 + 8개의 얇은 다리 블록
// ---------------------------------------------------------------------------
function buildOctopus(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const mantle = new THREE.Mesh(box(0.5 * s, 0.46 * s, 0.5 * s), bodyMat)
  mantle.position.y = 0.42 * s
  group.add(mantle)

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(box(0.08 * s, 0.08 * s, 0.03 * s), darkMat)
    eye.position.set(side * 0.13 * s, 0.46 * s, 0.26 * s)
    group.add(eye)
  }

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const leg = new THREE.Mesh(box(0.07 * s, 0.38 * s, 0.07 * s), accentMat)
    leg.position.set(Math.cos(angle) * 0.18 * s, 0.19 * s, Math.sin(angle) * 0.18 * s)
    leg.rotation.z = Math.cos(angle) * 0.35
    leg.rotation.x = Math.sin(angle) * 0.35
    group.add(leg)
  }

  return group
}

// ---------------------------------------------------------------------------
// 물고기 (잉어/송어): 각진 유선형 몸통 블록 + 지느러미
// ---------------------------------------------------------------------------
function buildFish(species: SpeciesDef): THREE.Group {
  const group = new THREE.Group()
  const s = species.scale
  const bodyMat = mat(species.bodyColor)
  const accentMat = mat(species.accentColor)
  const darkMat = mat(0x2b2b2b)

  const body = new THREE.Mesh(box(0.68 * s, 0.32 * s, 0.32 * s), bodyMat)
  body.position.y = 0.2 * s
  group.add(body)

  const eye = new THREE.Mesh(box(0.03 * s, 0.05 * s, 0.05 * s), darkMat)
  eye.position.set(0.35 * s, 0.24 * s, 0)
  group.add(eye)

  const tailFin = new THREE.Mesh(box(0.04 * s, 0.26 * s, 0.3 * s), accentMat)
  tailFin.position.set(-0.38 * s, 0.2 * s, 0)
  group.add(tailFin)

  const dorsalFin = new THREE.Mesh(box(0.22 * s, 0.16 * s, 0.03 * s), accentMat)
  dorsalFin.position.set(0, 0.38 * s, 0)
  group.add(dorsalFin)

  for (const side of [-1, 1]) {
    const sideFin = new THREE.Mesh(box(0.16 * s, 0.03 * s, 0.14 * s), accentMat)
    sideFin.position.set(0.1 * s, 0.12 * s, side * 0.17 * s)
    group.add(sideFin)
  }

  return group
}

// ---------------------------------------------------------------------------
// 뱀: 점점 작아지는 블록을 이어 붙인 몸통
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
    const size = 0.24 * s * (1 - t * 0.55)
    const seg = new THREE.Mesh(box(size, size, size), bodyMat)
    seg.position.set(Math.sin(t * Math.PI * 1.4) * 0.16 * s, size * 0.55, 0.4 * s - t * 0.8 * s)
    group.add(seg)
  }

  const headSize = 0.24 * s
  const head = new THREE.Mesh(box(headSize, headSize, headSize), bodyMat)
  head.position.set(0, headSize * 0.55, 0.42 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(box(0.05 * s, 0.05 * s, 0.02 * s), darkMat)
    eye.position.set(side * headSize * 0.28, head.position.y + headSize * 0.2, head.position.z + headSize * 0.51)
    group.add(eye)
  }
  const tongue = new THREE.Mesh(box(0.03 * s, 0.02 * s, 0.16 * s), accentMat)
  tongue.position.set(0, headSize * 0.35, head.position.z + headSize * 0.55)
  group.add(tongue)

  return group
}

// ---------------------------------------------------------------------------
// 곤충 (잠자리): 가느다란 블록 몸통 + 두 쌍의 얇은 판 날개
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

  const body = new THREE.Mesh(box(0.09 * s, 0.09 * s, 0.5 * s), bodyMat)
  body.position.y = 0.3 * s
  group.add(body)

  const head = new THREE.Mesh(box(0.14 * s, 0.14 * s, 0.14 * s), bodyMat)
  head.position.set(0, 0.3 * s, 0.28 * s)
  group.add(head)
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(box(0.05 * s, 0.05 * s, 0.03 * s), darkMat)
    eye.position.set(side * 0.05 * s, 0.32 * s, 0.34 * s)
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

/** 플레이어/NPC 등 사람 캐릭터의 블록(마인크래프트풍) 메시를 만든다. */
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
    const leg = new THREE.Mesh(box(0.22, legLen, 0.22), pantsMat)
    leg.position.set(side * 0.13, legLen / 2, 0)
    leg.castShadow = true
    group.add(leg)
  }

  const torso = new THREE.Mesh(box(0.5, 0.55, 0.3), shirtMat)
  torso.position.y = legLen + 0.275
  torso.castShadow = true
  group.add(torso)

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(box(0.18, 0.5, 0.18), shirtMat)
    arm.position.set(side * 0.34, legLen + 0.28, 0)
    arm.castShadow = true
    group.add(arm)
    const hand = new THREE.Mesh(box(0.18, 0.12, 0.18), skinMat)
    hand.position.set(side * 0.34, legLen + 0.01, 0)
    group.add(hand)
  }

  const head = new THREE.Mesh(box(0.46, 0.46, 0.46), skinMat)
  head.position.y = legLen + 0.55 + 0.23
  head.castShadow = true
  group.add(head)

  if (opts.hat !== undefined) {
    const hatMat = mat(opts.hat)
    const brim = new THREE.Mesh(box(0.62, 0.06, 0.62), hatMat)
    brim.position.y = head.position.y + 0.26
    group.add(brim)
    const crown = new THREE.Mesh(box(0.34, 0.22, 0.34), hatMat)
    crown.position.y = head.position.y + 0.4
    group.add(crown)
  }

  return group
}
