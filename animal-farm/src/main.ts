import * as THREE from 'three'
import './styles.css'
import { GameState } from './core/GameState.ts'
import { AnimalSfx } from './audio/AnimalSfx.ts'
import { EffectsManager } from './fx/Effects.ts'
import { Player, type MoveInput } from './player/Player.ts'
import { RopeController } from './player/RopeController.ts'
import { UI } from './ui/UI.ts'
import { World, type HarvestNode } from './world/World.ts'
import type { Animal } from './world/Animal.ts'

const app = document.getElementById('app')
if (!app) throw new Error('#app 요소를 찾을 수 없습니다')

// ---------------------------------------------------------------------------
// 시작 화면
// ---------------------------------------------------------------------------
const startScreen = document.createElement('div')
startScreen.className = 'start-screen'
startScreen.innerHTML = `
  <h1>🐑 민주호의 동물농장</h1>
  <p>
    자연을 탐험하며 동물을 찾고, 밧줄을 던져 데려온 뒤 농장 울타리 안에서 길러보세요.
    초원 · 바다 · 산 · 강, 4개의 자연에 서로 다른 동물들이 살고 있어요.
  </p>
  <div class="controls-box">
    ⬆️⬇️⬅️➡️ (또는 WASD) : 이동<br/>
    Space : 점프<br/>
    마우스 클릭 : 동물에게 밧줄 던지기 / 나무·바위 채집 (가까이 다가가야 해요)<br/>
    우클릭 / Q : 밧줄 풀기 · 밧줄은 인벤토리에서 여러 개로 늘릴 수 있어요<br/>
    F : 근처 NPC와 상호작용<br/>
    I : 인벤토리 · L : 퀘스트 · K : 스킬 트리<br/>
    🐦 나는 동물은 땅이나 물 위에 앉아 있을 때만, 🐚 조개·게는 땅 위로 나와 있을 때만 포획할 수 있어요
  </div>
  <button class="start-btn">농장 시작하기 🌱</button>
`
app.append(startScreen)

// ---------------------------------------------------------------------------
// 렌더러 / 씬 기본 요소
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.className = 'game-canvas'
app.append(renderer.domElement)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300)

const world = new World()
const player = new Player()
world.scene.add(player.mesh)
const rope = new RopeController(world.scene)
const effects = new EffectsManager(world.scene)
const sfx = new AnimalSfx()
const state = new GameState()
const ui = new UI(app, state)

// 인트로 카메라 각도 (시작 전 농장을 비스듬히 비춘다)
camera.position.set(14, 12, 20)
camera.lookAt(0, 1, 0)

const debugState = { freezeCamera: false }
if (import.meta.env.DEV) {
  // 개발 중 수동/자동 테스트 편의를 위한 디버그 훅 (프로덕션 빌드에는 포함되지 않음)
  ;(window as unknown as { __debug: unknown }).__debug = { world, player, state, rope, camera, debugState }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// ---------------------------------------------------------------------------
// 입력 처리
// ---------------------------------------------------------------------------
const keys = new Set<string>()
const MOVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
])

window.addEventListener('keydown', (e) => {
  keys.add(e.code)
  if (MOVE_KEYS.has(e.code)) e.preventDefault()
  if (!started) return
  if (e.code === 'KeyI') ui.togglePanel('inventory')
  else if (e.code === 'KeyL') ui.togglePanel('quests')
  else if (e.code === 'KeyK') ui.togglePanel('skills')
  else if (e.code === 'Escape') ui.closePanel()
  else if (e.code === 'KeyQ') rope.releaseAll()
  else if (e.code === 'KeyF' || e.code === 'KeyE') tryInteractNpc()
})
window.addEventListener('keyup', (e) => keys.delete(e.code))

function readMoveInput(): MoveInput {
  if (!started || ui.isPanelOpen) return { x: 0, z: 0, jump: false }
  let x = 0
  let z = 0
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1
  if (keys.has('ArrowUp') || keys.has('KeyW')) z -= 1
  if (keys.has('ArrowDown') || keys.has('KeyS')) z += 1
  const jump = keys.has('Space')
  return { x, z, jump }
}

function tryInteractNpc(): void {
  if (ui.isPanelOpen) return
  if (world.npc.distanceTo(player.position) <= world.npc.interactRadius) {
    ui.openShop()
  }
}

renderer.domElement.addEventListener('click', (e) => {
  if (!started || ui.isPanelOpen) return
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1,
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  const animalMeshes = world.animals.map((a) => a.mesh)
  const harvestMeshes = world.harvestObjects
  const hits = raycaster.intersectObjects([...animalMeshes, ...harvestMeshes], true)
  if (hits.length === 0) return
  const hitObject = hits[0]!.object

  let obj: THREE.Object3D | null = hitObject
  let animalId: number | undefined
  while (obj) {
    if (typeof obj.userData.animalId === 'number') {
      animalId = obj.userData.animalId
      break
    }
    obj = obj.parent
  }
  if (animalId !== undefined) {
    const animal = world.animals.find((a) => a.id === animalId)
    if (animal) attemptCapture(animal)
    return
  }

  const node = world.findHarvestNode(hitObject)
  if (node) attemptHarvest(node)
})

renderer.domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  rope.releaseAll()
})

const HARVEST_REACH = 3.2

function attemptHarvest(node: HarvestNode): void {
  const dist = player.position.distanceTo(node.object.position)
  if (dist > HARVEST_REACH) {
    ui.showToast('가까이 다가가야 채집할 수 있어요', 'warning')
    return
  }
  const message = node.type === 'wood' ? '나무를 얻었어요! (+1)' : '광물을 얻었어요! (+1)'
  const pos = world.harvest(node)
  state.addItem(node.type, 1)
  effects.burst(pos, node.type === 'wood' ? 0x4f9a4a : 0x8f8b83)
  ui.showToast(message, 'success')
  ui.refreshHUD()
}

function attemptCapture(animal: Animal): void {
  if (!animal.capturable) {
    if (animal.isAirborne) {
      ui.showToast(`${animal.species.name}이(가) 날고 있어요! 땅이나 물 위에 앉을 때까지 기다리세요`, 'warning')
    }
    return
  }
  const range = state.ropeTier.range + state.ropeRangeBonus
  const dist = player.position.distanceTo(animal.position)
  if (dist > range) {
    ui.showToast(`${animal.species.name}에게 더 가까이 다가가세요`, 'warning')
    return
  }
  if (animal.species.requiredRopeTier > state.ropeTierId) {
    ui.showToast(`${animal.species.name}은(는) 더 강한 밧줄이 필요해요!`, 'warning')
    return
  }
  if (rope.count >= state.maxRopes) {
    ui.showToast(`밧줄을 더 쓸 수 없어요 (최대 ${state.maxRopes}개)`, 'warning')
    return
  }
  rope.attach(animal)
  sfx.playCry(animal.species, dist)
  ui.showToast(`${animal.species.name}에게 밧줄을 던졌어요! 농장으로 데려가세요`, 'info')
}

function onDeliver(animal: Animal): void {
  world.moveToPen(animal)
  const result = state.deliverAnimal(animal.species.id)
  sfx.playCry(animal.species, 1)
  effects.burst(animal.position, animal.species.bodyColor)
  ui.showToast(`${animal.species.name}을(를) 농장에 데려왔어요! +15XP`, 'success')
  if (result.droppedItem) {
    ui.showToast(`${animal.species.name}이(가) 선물을 주고 갔어요! (재료 획득)`, 'success')
  }
  for (const q of result.completedQuests) {
    ui.showToast(`퀘스트 완료! (${q.speciesId} ${q.tier}단계) 보상 획득`, 'success')
  }
  if (result.leveledUp) {
    ui.showToast(`레벨 업! Lv.${result.newLevel} 달성 🎉 스킬 포인트 +1`, 'levelup')
  }
  if (state.penTotal === state.penCapacity) {
    ui.showToast('농장이 거의 다 찼어요! 스킬 트리에서 "우리 확장"을 배워보세요', 'warning')
  }
  ui.refreshHUD()
}

// ---------------------------------------------------------------------------
// 메인 루프
// ---------------------------------------------------------------------------
let started = false
const clock = new THREE.Clock()

startScreen.querySelector('.start-btn')!.addEventListener('click', () => {
  started = true
  sfx.unlock()
  startScreen.remove()
  clock.start()
  renderer.domElement.focus()
})

function updateCamera(dt: number): void {
  if (debugState.freezeCamera) return
  const facing = player.facing
  const desired = new THREE.Vector3(
    player.position.x - facing.x * 7.5,
    player.position.y + 4.8,
    player.position.z - facing.z * 7.5,
  )
  const alpha = 1 - Math.pow(0.0005, dt)
  camera.position.lerp(desired, alpha)
  camera.lookAt(player.position.x, player.position.y + 1.4, player.position.z)
}

function updatePrompt(): void {
  if (ui.isPanelOpen) {
    ui.setPrompt(null)
    return
  }
  const npcDist = world.npc.distanceTo(player.position)
  if (npcDist <= world.npc.interactRadius) {
    ui.setPrompt('F : 사료 가게 아저씨와 이야기하기')
    return
  }
  const captureRange = state.ropeTier.range + state.ropeRangeBonus
  const nearest = world.findNearestWild(player.position, captureRange + 8)
  if (nearest) {
    const dist = player.position.distanceTo(nearest.position)
    if (dist <= captureRange) {
      ui.setPrompt(`클릭 : ${nearest.species.name}에게 밧줄 던지기`)
      return
    }
    ui.setPrompt(`${nearest.species.name}이(가) 근처에 있어요 · 더 다가가세요`)
    return
  }
  if (rope.count > 0) {
    ui.setPrompt('농장 울타리 안으로 동물을 데려가세요')
    return
  }
  ui.setPrompt(null)
}

function frame(): void {
  requestAnimationFrame(frame)
  const dt = Math.min(clock.getDelta(), 0.05)

  if (started) {
    const moveInput = readMoveInput()
    player.update(dt, moveInput, state.moveSpeedMultiplier)
    world.clampToWorld(player.position)
    world.resolveCollision(player.position)

    world.update(dt, (animal) => {
      const dist = player.position.distanceTo(animal.position)
      sfx.playCry(animal.species, dist)
    })

    const dragSpeed = state.ropeTier.dragSpeed * state.dragSpeedMultiplier
    rope.update(dt, player.position, player.facing, dragSpeed, world.penCenter, world.penRadius, onDeliver)

    effects.update(dt)
    updateCamera(dt)
    updatePrompt()
    ui.updateRopeCount(rope.count)
    ui.refreshHUD()
  }

  renderer.render(world.scene, camera)
}

frame()
