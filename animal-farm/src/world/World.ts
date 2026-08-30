import * as THREE from 'three'
import { BIOMES, SPECIES } from '../core/data.ts'
import type { BiomeDef, SpeciesDef } from '../core/types.ts'
import { Animal, type Bounds } from './Animal.ts'
import { tiledBlockTexture } from './blockTexture.ts'
import { NPC } from './NPC.ts'

const WORLD_HALF_EXTENT = 95
const RESPAWN_SECONDS = 32

/** 포획 난이도(밧줄 등급)가 높을수록 희귀한 동물이므로 초기 개체 수를 줄인다. */
function initialCountFor(species: SpeciesDef): number {
  if (species.requiredRopeTier >= 2) return 1
  if (species.requiredRopeTier === 1) return 2
  return 3
}

interface SpawnGroup {
  species: SpeciesDef
  bounds: Bounds
  targetCount: number
  alive: Animal[]
  respawnTimer: number
}

/** 4개 자연 지역(초원/바다/산/강) + 농장 허브로 이루어진 게임 월드 전체를 구성/관리한다. */
export class World {
  readonly scene = new THREE.Scene()
  readonly animals: Animal[] = []
  readonly npc: NPC
  readonly penCenter = new THREE.Vector3(0, 0, 0)
  readonly penRadius = 11

  private spawnGroups: SpawnGroup[] = []

  constructor() {
    this.scene.background = new THREE.Color(0xbfe6f5)
    this.scene.fog = new THREE.Fog(0xbfe6f5, 60, 150)

    this.buildLights()
    this.buildGround()
    this.buildFarmHub()
    this.buildBiomeDecorations()

    this.npc = new NPC(new THREE.Vector3(5.5, 0, -10))
    this.scene.add(this.npc.mesh)

    this.spawnAllAnimals()
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.4)
    sun.position.set(30, 45, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -90
    sun.shadow.camera.right = 90
    sun.shadow.camera.top = 90
    sun.shadow.camera.bottom = -90
    sun.shadow.camera.far = 160
    this.scene.add(sun)
    this.scene.add(sun.target)
  }

  private buildGround(): void {
    const baseSize = WORLD_HALF_EXTENT * 2.4
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(baseSize, baseSize),
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0x8fce7a, baseSize, baseSize),
        flatShading: true,
        roughness: 1,
      }),
    )
    base.rotation.x = -Math.PI / 2
    base.receiveShadow = true
    this.scene.add(base)

    for (const biome of Object.values(BIOMES)) {
      if (biome.id === 'farm') continue
      const diameter = biome.halfSize * 2
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(biome.halfSize, 24),
        new THREE.MeshStandardMaterial({
          map: tiledBlockTexture(biome.groundColor, diameter, diameter),
          flatShading: true,
          roughness: 1,
        }),
      )
      patch.rotation.x = -Math.PI / 2
      patch.position.set(biome.center.x, 0.01, biome.center.z)
      patch.receiveShadow = true
      this.scene.add(patch)
    }

    // 바다 (동쪽 바다 바이옴 바깥으로 이어지는 큰 수면)
    const coast = BIOMES.coast!
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 90),
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0x3f8fd1, 70, 90),
        flatShading: true,
        transparent: true,
        opacity: 0.92,
        roughness: 1,
      }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.set(coast.center.x + 55, -0.08, coast.center.z)
    this.scene.add(water)

    // 강 (서쪽 강 바이옴을 가로지르는 물줄기)
    const river = BIOMES.river!
    const riverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 80),
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0x4f9fd8, 14, 80),
        flatShading: true,
        transparent: true,
        opacity: 0.92,
        roughness: 1,
      }),
    )
    riverMesh.rotation.x = -Math.PI / 2
    riverMesh.rotation.z = 0.25
    riverMesh.position.set(river.center.x, -0.06, river.center.z)
    this.scene.add(riverMesh)
  }

  private buildFarmHub(): void {
    // 울타리 (각진 기둥을 원형으로 배치, 출입구 부분은 비워둔다)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x8a6339, flatShading: true, roughness: 1 })
    const postCount = 28
    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2
      // 남쪽(플레이어 스폰 방향)에 출입구를 남겨둔다
      if (angle > Math.PI * 0.85 && angle < Math.PI * 1.15) continue
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), postMat)
      post.position.set(Math.cos(angle) * this.penRadius, 0.55, Math.sin(angle) * this.penRadius)
      post.castShadow = true
      this.scene.add(post)
    }

    // 헛간 (박공지붕도 두 개의 각진 슬래브로 표현)
    const barn = new THREE.Group()
    const barnBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.2, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xb5453a, flatShading: true, roughness: 1 }),
    )
    barnBody.position.y = 1.1
    barnBody.castShadow = true
    barn.add(barnBody)
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3d2e, flatShading: true, roughness: 1 })
    for (const side of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 2.0), roofMat)
      slab.position.set(0, 2.35, side * 0.62)
      slab.rotation.x = side * 0.55
      slab.castShadow = true
      barn.add(slab)
    }
    barn.position.set(-6, 0, 3)
    barn.rotation.y = 0.4
    this.scene.add(barn)
  }

  private buildBiomeDecorations(): void {
    const rng = mulberry32(1234)

    // 초원: 나무
    const grassland = BIOMES.grassland!
    for (let i = 0; i < 16; i++) {
      const p = randomInBiome(grassland, rng, 6)
      this.scene.add(buildTree(p, 0.8 + rng() * 0.6))
    }

    // 산: 바위 + 큰 산 실루엣
    const mountain = BIOMES.mountain!
    for (let i = 0; i < 14; i++) {
      const p = randomInBiome(mountain, rng, 5)
      this.scene.add(buildRock(p, 0.5 + rng() * 0.9))
    }
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI + 0.3
      const p = new THREE.Vector3(
        mountain.center.x + Math.cos(angle) * mountain.halfSize * 0.75,
        0,
        mountain.center.z + Math.sin(angle) * mountain.halfSize * 0.5 + 12,
      )
      this.scene.add(buildMountainPeak(p, 6 + rng() * 4))
    }

    // 바다: 바위 + 유목
    const coast = BIOMES.coast!
    for (let i = 0; i < 8; i++) {
      const p = randomInBiome(coast, rng, 5)
      this.scene.add(buildRock(p, 0.3 + rng() * 0.4))
    }

    // 강: 갈대
    const river = BIOMES.river!
    for (let i = 0; i < 18; i++) {
      const p = randomInBiome(river, rng, 5)
      this.scene.add(buildReed(p))
    }
  }

  private spawnAllAnimals(): void {
    for (const species of SPECIES) {
      const biome = BIOMES[species.biome]
      if (!biome) continue
      const bounds = species.swimsInWater ? waterBounds(biome) : biomeBounds(biome)
      const targetCount = initialCountFor(species)
      const group: SpawnGroup = { species, bounds, targetCount, alive: [], respawnTimer: 0 }
      for (let i = 0; i < targetCount; i++) {
        this.spawnOne(group)
      }
      this.spawnGroups.push(group)
    }
  }

  private spawnOne(group: SpawnGroup): void {
    const pos = randomPointInBounds(group.bounds)
    const animal = new Animal(group.species, pos, group.bounds)
    group.alive.push(animal)
    this.animals.push(animal)
    this.scene.add(animal.mesh)
  }

  /** 매 프레임 호출. 동물 AI 갱신 + 죽은(포획 후 이동된) 그룹 리스폰 처리. onCry로 개별 동물의 울음 트리거를 알려준다. */
  update(dt: number, onCry: (animal: Animal) => void): void {
    for (const a of this.animals) {
      const { cried } = a.update(dt)
      if (cried) onCry(a)
    }

    for (const group of this.spawnGroups) {
      group.alive = group.alive.filter((a) => a.state === 'wild')
      if (group.alive.length < group.targetCount) {
        group.respawnTimer -= dt
        if (group.respawnTimer <= 0) {
          group.respawnTimer = RESPAWN_SECONDS
          this.spawnOne(group)
        }
      }
    }
  }

  /** 포획 가능한(야생 상태) 동물 중 지점에서 가장 가까운 것을 반환 */
  findNearestWild(position: THREE.Vector3, maxRange: number): Animal | null {
    let best: Animal | null = null
    let bestDist = maxRange
    for (const a of this.animals) {
      if (a.state !== 'wild') continue
      const d = a.position.distanceTo(position)
      if (d <= bestDist) {
        bestDist = d
        best = a
      }
    }
    return best
  }

  /** 사육장으로 이동한 동물을 사육장 안에서 배회하도록 전환 */
  moveToPen(animal: Animal): void {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * (this.penRadius - 1.5)
    animal.setBounds({
      minX: this.penCenter.x - this.penRadius + 1.5,
      maxX: this.penCenter.x + this.penRadius - 1.5,
      minZ: this.penCenter.z - this.penRadius + 1.5,
      maxZ: this.penCenter.z + this.penRadius - 1.5,
    })
    animal.position.set(
      this.penCenter.x + Math.cos(angle) * r,
      0,
      this.penCenter.z + Math.sin(angle) * r,
    )
    animal.state = 'penned'
  }

  clampToWorld(pos: THREE.Vector3): void {
    pos.x = THREE.MathUtils.clamp(pos.x, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT)
    pos.z = THREE.MathUtils.clamp(pos.z, -WORLD_HALF_EXTENT, WORLD_HALF_EXTENT)
  }
}

function biomeBounds(biome: BiomeDef): Bounds {
  return {
    // 0.7 = 원형 바이옴 패치(반지름 halfSize) 안에 완전히 들어가는 정사각형의 절반 크기(1/sqrt(2))
    minX: biome.center.x - biome.halfSize * 0.7,
    maxX: biome.center.x + biome.halfSize * 0.7,
    minZ: biome.center.z - biome.halfSize * 0.7,
    maxZ: biome.center.z + biome.halfSize * 0.7,
  }
}

/**
 * 완전히 물속에서 사는 종(불가사리/바다거북/문어/조개/잉어/송어)을 위한 서식 범위.
 * buildGround()에서 그린 실제 수면 위치(바다는 바이옴 동쪽 절반, 강은 중심을 가로지르는 좁은 물줄기)에 맞춘 근사치다.
 */
function waterBounds(biome: BiomeDef): Bounds {
  const b = biomeBounds(biome)
  if (biome.id === 'coast') {
    return { ...b, minX: biome.center.x }
  }
  if (biome.id === 'river') {
    return { ...b, minX: biome.center.x - 8, maxX: biome.center.x + 8 }
  }
  return b
}

function randomPointInBounds(b: Bounds): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.randFloat(b.minX, b.maxX),
    0,
    THREE.MathUtils.randFloat(b.minZ, b.maxZ),
  )
}

function randomInBiome(biome: BiomeDef, rng: () => number, margin: number): THREE.Vector3 {
  const r = margin + rng() * (biome.halfSize - margin)
  const a = rng() * Math.PI * 2
  return new THREE.Vector3(biome.center.x + Math.cos(a) * r, 0, biome.center.z + Math.sin(a) * r)
}

function buildTree(pos: THREE.Vector3, scale: number): THREE.Group {
  const g = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5233, flatShading: true, roughness: 1 })
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 1.2 * scale, 0.3 * scale), trunkMat)
  trunk.position.y = 0.6 * scale
  trunk.castShadow = true
  g.add(trunk)

  // 잎사귀는 각기 다른 크기의 상자를 겹쳐 쌓아 블록형 나무 수관을 만든다
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f9a4a, flatShading: true, roughness: 1 })
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 0.8 * scale, 1.5 * scale), leafMat)
  lower.position.y = 1.35 * scale
  lower.castShadow = true
  g.add(lower)
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 0.75 * scale, 1.0 * scale), leafMat)
  upper.position.y = 1.95 * scale
  upper.castShadow = true
  g.add(upper)

  g.position.copy(pos)
  return g
}

function buildRock(pos: THREE.Vector3, scale: number): THREE.Group {
  const g = new THREE.Group()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8f8b83, flatShading: true, roughness: 1 })
  // 크기가 다른 상자 2~3개를 겹쳐서 각진 돌무더기를 표현한다
  const main = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.7 * scale, 0.8 * scale), rockMat)
  main.position.y = 0.35 * scale
  main.rotation.y = Math.random() * Math.PI
  main.castShadow = true
  g.add(main)
  const small = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.45 * scale, 0.5 * scale), rockMat)
  small.position.set(0.35 * scale, 0.22 * scale, -0.3 * scale)
  small.rotation.y = Math.random() * Math.PI
  small.castShadow = true
  g.add(small)
  g.position.copy(pos)
  g.rotation.y = Math.random() * Math.PI * 2
  return g
}

function buildMountainPeak(pos: THREE.Vector3, scale: number): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x7d7d78, flatShading: true, roughness: 1 })
  // 위로 갈수록 작아지는 상자를 쌓아 각진 산 실루엣을 만든다
  const tiers = 4
  let y = 0
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1)
    const size = scale * (1 - t * 0.65)
    const height = scale * 0.4
    const tier = new THREE.Mesh(new THREE.BoxGeometry(size, height, size), mat)
    tier.position.y = y + height / 2
    tier.rotation.y = i * 0.4
    g.add(tier)
    y += height * 0.85
  }
  g.position.copy(pos)
  return g
}

function buildReed(pos: THREE.Vector3): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0x5fa04a, flatShading: true, roughness: 1 })
  for (let i = 0; i < 3; i++) {
    const height = 0.6 + Math.random() * 0.3
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, height, 0.05), mat)
    blade.position.set((Math.random() - 0.5) * 0.2, height / 2, (Math.random() - 0.5) * 0.2)
    blade.rotation.y = Math.random() * Math.PI
    g.add(blade)
  }
  g.position.copy(pos)
  return g
}

function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
