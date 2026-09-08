import * as THREE from 'three'
import { BIOMES, SPECIES } from '../core/data.ts'
import type { BiomeDef, SpeciesDef } from '../core/types.ts'
import { Animal, type Bounds } from './Animal.ts'
import { tiledBlockTexture } from './blockTexture.ts'
import { NPC } from './NPC.ts'

const WORLD_HALF_EXTENT = 170
const GROUND_SIZE = 380
const RESPAWN_SECONDS = 32
const HARVEST_RESPAWN_MIN = 20
const HARVEST_RESPAWN_RANGE = 25

/** 포획 난이도(밧줄 등급)가 높을수록 희귀한 동물이므로 초기 개체 수를 줄인다. */
function initialCountFor(species: SpeciesDef): number {
  if (species.requiredRopeTier >= 2) return 1
  if (species.requiredRopeTier === 1) return 2
  return 3
}

interface SpawnGroup {
  species: SpeciesDef
  bounds: Bounds
  waterLandingBounds: Bounds | null
  targetCount: number
  alive: Animal[]
  respawnTimer: number
}

interface Collider {
  x: number
  z: number
  radius: number
}

export interface HarvestNode {
  id: number
  type: 'wood' | 'ore'
  object: THREE.Object3D
  biome: BiomeDef
  scale: number
  alive: boolean
  respawnTimer: number
  collider: Collider
}

/** 4개 자연 지역(초원/바다/산/강) + 농장 허브로 이루어진 게임 월드 전체를 구성/관리한다. */
export class World {
  readonly scene = new THREE.Scene()
  readonly animals: Animal[] = []
  readonly npc: NPC
  readonly penCenter = new THREE.Vector3(0, 0, 0)
  readonly penRadius = 11

  private spawnGroups: SpawnGroup[] = []
  private colliders: Collider[] = []
  private harvestNodes: HarvestNode[] = []
  private nextHarvestId = 1

  constructor() {
    this.scene.background = new THREE.Color(0xbfe6f5)
    this.scene.fog = new THREE.Fog(0xbfe6f5, 110, 280)

    this.buildLights()
    this.buildGround()
    this.buildFarmHub()
    this.buildBiomeDecorations()

    this.npc = new NPC(new THREE.Vector3(5.5, 0, -10))
    this.scene.add(this.npc.mesh)
    this.colliders.push({ x: this.npc.mesh.position.x, z: this.npc.mesh.position.z, radius: 1.3 })

    this.spawnAllAnimals()
  }

  private buildLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5a7a4a, 1.1)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff3d6, 1.4)
    sun.position.set(30, 45, 20)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -160
    sun.shadow.camera.right = 160
    sun.shadow.camera.top = 160
    sun.shadow.camera.bottom = -160
    sun.shadow.camera.far = 260
    this.scene.add(sun)
    this.scene.add(sun.target)
  }

  /**
   * 지면 전체를 하나의 메시로 만들고, 정점 색을 바이옴 중심으로부터의 거리 기반 가중치로
   * 부드럽게 섞는다. 원형 패치를 따로 그리지 않으므로 지역 사이에 각진 경계선이 생기지 않는다.
   * 바다 바이옴은 농장과 가까운 쪽은 모래색, 먼 바깥쪽은 실제 바다색으로 한 번 더 섞는다.
   */
  private buildGround(): void {
    const segments = 64
    const geometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, segments, segments)
    const posAttr = geometry.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(posAttr.count * 3)

    const biomeList = Object.values(BIOMES)
    const baseColor = new THREE.Color(0x8fce7a)
    const sandColor = new THREE.Color(0xe4d9a5)
    const seaColor = new THREE.Color(0x2569ad)
    const coast = BIOMES.coast!
    const BASE_WEIGHT = 0.35

    const tmp = new THREE.Color()
    for (let i = 0; i < posAttr.count; i++) {
      const worldX = posAttr.getX(i)
      const worldZ = -posAttr.getY(i)

      let r = baseColor.r * BASE_WEIGHT
      let g = baseColor.g * BASE_WEIGHT
      let b = baseColor.b * BASE_WEIGHT
      let totalWeight = BASE_WEIGHT

      for (const biome of biomeList) {
        const dx = worldX - biome.center.x
        const dz = worldZ - biome.center.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        const w = falloff(dist, biome.halfSize)
        if (w <= 0) continue

        if (biome.id === 'coast') {
          const t = smoothstep(coast.center.x - coast.halfSize * 0.1, coast.center.x + coast.halfSize * 0.55, worldX)
          tmp.copy(sandColor).lerp(seaColor, t)
        } else {
          tmp.set(biome.groundColor)
        }
        r += tmp.r * w
        g += tmp.g * w
        b += tmp.b * w
        totalWeight += w
      }

      colors[i * 3] = r / totalWeight
      colors[i * 3 + 1] = g / totalWeight
      colors[i * 3 + 2] = b / totalWeight
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0xffffff, GROUND_SIZE, GROUND_SIZE),
        vertexColors: true,
        flatShading: true,
        roughness: 1,
      }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    // 바다 위에 살짝 비치는 반투명 수면 (실제 색은 위 지면 블렌딩에서 이미 바다색)
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(coast.halfSize * 1.4, coast.halfSize * 2),
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0x3f8fd1, coast.halfSize * 1.4, coast.halfSize * 2),
        flatShading: true,
        transparent: true,
        opacity: 0.55,
        roughness: 1,
      }),
    )
    water.rotation.x = -Math.PI / 2
    water.position.set(coast.center.x + coast.halfSize * 0.35, 0.05, coast.center.z)
    this.scene.add(water)

    // 강 (중심을 가로지르는 물줄기)
    const river = BIOMES.river!
    const riverMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, river.halfSize * 2.6),
      new THREE.MeshStandardMaterial({
        map: tiledBlockTexture(0x4f9fd8, 20, river.halfSize * 2.6),
        flatShading: true,
        transparent: true,
        opacity: 0.85,
        roughness: 1,
      }),
    )
    riverMesh.rotation.x = -Math.PI / 2
    riverMesh.rotation.z = 0.25
    riverMesh.position.set(river.center.x, 0.03, river.center.z)
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
      const px = Math.cos(angle) * this.penRadius
      const pz = Math.sin(angle) * this.penRadius
      post.position.set(px, 0.55, pz)
      post.castShadow = true
      this.scene.add(post)
      this.colliders.push({ x: px, z: pz, radius: 0.22 })
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
    this.colliders.push({ x: barn.position.x, z: barn.position.z, radius: 2.2 })
  }

  private buildBiomeDecorations(): void {
    const rng = mulberry32(1234)

    // 초원: 나무 (채집 가능한 나무 노드)
    const grassland = BIOMES.grassland!
    for (let i = 0; i < 30; i++) {
      const p = randomInBiome(grassland, rng, 8)
      this.addHarvestNode('wood', grassland, p, 0.8 + rng() * 0.6)
    }

    // 산: 바위(채집 가능한 광물 노드) + 큰 산 실루엣(장식+충돌)
    const mountain = BIOMES.mountain!
    for (let i = 0; i < 22; i++) {
      const p = randomInBiome(mountain, rng, 6)
      this.addHarvestNode('ore', mountain, p, 0.5 + rng() * 0.9)
    }
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI + 0.3
      const scale = 6 + rng() * 4
      const p = new THREE.Vector3(
        mountain.center.x + Math.cos(angle) * mountain.halfSize * 0.75,
        0,
        mountain.center.z + Math.sin(angle) * mountain.halfSize * 0.5 + 20,
      )
      this.scene.add(buildMountainPeak(p, scale))
      this.colliders.push({ x: p.x, z: p.z, radius: scale * 0.4 })
    }

    // 바다: 바위(채집 가능한 광물 노드)
    const coast = BIOMES.coast!
    for (let i = 0; i < 14; i++) {
      const p = randomInBiome(coast, rng, 6)
      this.addHarvestNode('ore', coast, p, 0.3 + rng() * 0.4)
    }

    // 강: 갈대 (장식 전용, 채집/충돌 없음)
    const river = BIOMES.river!
    for (let i = 0; i < 30; i++) {
      const p = randomInBiome(river, rng, 6)
      this.scene.add(buildReed(p))
    }
  }

  private addHarvestNode(type: 'wood' | 'ore', biome: BiomeDef, position: THREE.Vector3, scale: number): void {
    const object = type === 'wood' ? buildTree(position, scale) : buildRock(position, scale)
    const id = this.nextHarvestId++
    object.userData.harvestId = id
    const collider: Collider = { x: position.x, z: position.z, radius: (type === 'wood' ? 0.5 : 0.55) * scale }
    this.colliders.push(collider)
    this.harvestNodes.push({ id, type, object, biome, scale, alive: true, respawnTimer: 0, collider })
    this.scene.add(object)
  }

  /** 클릭 지점에서 레이캐스트로 맞힌 오브젝트가 채집 가능한 노드인지 찾는다 */
  findHarvestNode(hitObject: THREE.Object3D): HarvestNode | undefined {
    let obj: THREE.Object3D | null = hitObject
    while (obj) {
      if (typeof obj.userData.harvestId === 'number') {
        const id = obj.userData.harvestId as number
        return this.harvestNodes.find((n) => n.id === id)
      }
      obj = obj.parent
    }
    return undefined
  }

  /** 채집 대상 메시 목록 (레이캐스트용) */
  get harvestObjects(): THREE.Object3D[] {
    return this.harvestNodes.filter((n) => n.alive).map((n) => n.object)
  }

  /** 노드를 채집 처리: 사라지고 시간이 지나면 다른 자리에 다시 자란다 */
  harvest(node: HarvestNode): THREE.Vector3 {
    const pos = node.object.position.clone()
    node.alive = false
    this.scene.remove(node.object)
    node.collider.radius = 0
    node.respawnTimer = HARVEST_RESPAWN_MIN + Math.random() * HARVEST_RESPAWN_RANGE
    return pos
  }

  private spawnAllAnimals(): void {
    for (const species of SPECIES) {
      const biome = BIOMES[species.biome]
      if (!biome) continue
      const bounds = species.swimsInWater ? waterBounds(biome) : biomeBounds(biome)
      const waterLandingBounds =
        species.wingType !== 'none' && (biome.id === 'coast' || biome.id === 'river') ? waterBounds(biome) : null
      const targetCount = initialCountFor(species)
      const group: SpawnGroup = { species, bounds, waterLandingBounds, targetCount, alive: [], respawnTimer: 0 }
      for (let i = 0; i < targetCount; i++) {
        this.spawnOne(group)
      }
      this.spawnGroups.push(group)
    }
  }

  private spawnOne(group: SpawnGroup): void {
    const pos = randomPointInBounds(group.bounds)
    const animal = new Animal(group.species, pos, group.bounds)
    if (group.waterLandingBounds) animal.setWaterLandingBounds(group.waterLandingBounds)
    group.alive.push(animal)
    this.animals.push(animal)
    this.scene.add(animal.mesh)
  }

  /** 매 프레임 호출. 동물 AI 갱신 + 채집 노드/동물 리스폰. onCry로 개별 동물의 울음 트리거를 알려준다. */
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

    for (const node of this.harvestNodes) {
      if (node.alive) continue
      node.respawnTimer -= dt
      if (node.respawnTimer <= 0) {
        const pos = randomInBiome(node.biome, Math.random, 6)
        const object = node.type === 'wood' ? buildTree(pos, node.scale) : buildRock(pos, node.scale)
        object.userData.harvestId = node.id
        node.object = object
        node.collider.x = pos.x
        node.collider.z = pos.z
        node.collider.radius = (node.type === 'wood' ? 0.5 : 0.55) * node.scale
        node.alive = true
        this.scene.add(object)
      }
    }
  }

  /** 포획 가능한(야생이고, 날거나 숨어있지 않은) 동물 중 지점에서 가장 가까운 것을 반환 */
  findNearestWild(position: THREE.Vector3, maxRange: number): Animal | null {
    let best: Animal | null = null
    let bestDist = maxRange
    for (const a of this.animals) {
      if (!a.capturable) continue
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
    animal.resetSpecialState()
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

  /** 플레이어가 나무/바위/헛간/상점/울타리를 통과하지 못하도록 밀어낸다 */
  resolveCollision(pos: THREE.Vector3, radius = 0.32): void {
    for (const c of this.colliders) {
      if (c.radius <= 0) continue
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      const distSq = dx * dx + dz * dz
      const minDist = c.radius + radius
      if (distSq < minDist * minDist && distSq > 1e-8) {
        const dist = Math.sqrt(distSq)
        const push = minDist - dist
        pos.x += (dx / dist) * push
        pos.z += (dz / dist) * push
      }
    }
  }
}

function falloff(dist: number, radius: number): number {
  const edge0 = radius * 0.55
  const edge1 = radius * 1.15
  if (dist <= edge0) return 1
  if (dist >= edge1) return 0
  return smoothstep(edge1, edge0, dist)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function biomeBounds(biome: BiomeDef): Bounds {
  return {
    // 0.7 = 원형 바이옴 영역(반지름 halfSize) 안에 완전히 들어가는 정사각형의 절반 크기(1/sqrt(2))
    minX: biome.center.x - biome.halfSize * 0.7,
    maxX: biome.center.x + biome.halfSize * 0.7,
    minZ: biome.center.z - biome.halfSize * 0.7,
    maxZ: biome.center.z + biome.halfSize * 0.7,
  }
}

/**
 * 완전히 물속에서 사는 종(불가사리/바다거북/문어/조개/잉어/송어)이나, 수면에 내려앉는 날짐승을 위한 서식 범위.
 * buildGround()에서 그린 실제 수면 위치(바다는 바이옴 동쪽 절반, 강은 중심을 가로지르는 좁은 물줄기)에 맞춘 근사치다.
 */
function waterBounds(biome: BiomeDef): Bounds {
  const b = biomeBounds(biome)
  if (biome.id === 'coast') {
    return { ...b, minX: biome.center.x }
  }
  if (biome.id === 'river') {
    return { ...b, minX: biome.center.x - 10, maxX: biome.center.x + 10 }
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
