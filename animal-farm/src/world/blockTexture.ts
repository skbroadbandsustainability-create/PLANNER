import * as THREE from 'three'

const baseTextureCache = new Map<number, THREE.CanvasTexture>()

/**
 * 색상별로 "블록 경계선이 보이는" 타일 텍스처를 캔버스로 즉석 생성한다.
 * 외부 이미지 파일 없이도 마인크래프트 특유의 각진 블록 바닥 느낌을 낸다.
 */
function baseBlockTexture(color: number): THREE.CanvasTexture {
  let tex = baseTextureCache.get(color)
  if (tex) return tex

  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const base = new THREE.Color(color)
  ctx.fillStyle = `#${base.getHexString()}`
  ctx.fillRect(0, 0, size, size)

  const edge = base.clone().multiplyScalar(0.75)
  ctx.strokeStyle = `#${edge.getHexString()}`
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)

  const speckle = base.clone().multiplyScalar(0.88)
  ctx.fillStyle = `#${speckle.getHexString()}`
  ctx.fillRect(5, 7, 4, 4)
  ctx.fillRect(20, 17, 5, 4)
  ctx.fillRect(13, 22, 4, 5)

  tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  baseTextureCache.set(color, tex)
  return tex
}

/** 위 텍스처를 지정한 반복 횟수(대략 1 반복 = 블록 1개)로 복제해서 반환한다. */
export function tiledBlockTexture(color: number, repeatX: number, repeatZ: number): THREE.CanvasTexture {
  const tex = baseBlockTexture(color).clone()
  tex.repeat.set(Math.max(1, repeatX), Math.max(1, repeatZ))
  tex.needsUpdate = true
  return tex
}
