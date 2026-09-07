// 키보드 입력 상태 관리 (프레임 단위 "눌린 순간" 감지 포함)

class InputManager {
  private down = new Set<string>()
  private pressedThisFrame = new Set<string>()

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.down.has(e.code)) {
        this.pressedThisFrame.add(e.code)
      }
      this.down.add(e.code)
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
        ].includes(e.code)
      ) {
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code)
    })
    window.addEventListener('blur', () => {
      this.down.clear()
    })
  }

  isDown(code: string): boolean {
    return this.down.has(code)
  }

  /** 이번 프레임에 새로 눌린 키인지 (연속 입력 방지) */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code)
  }

  /** 매 프레임 마지막에 호출해서 '눌린 순간' 상태를 비운다 */
  endFrame(): void {
    this.pressedThisFrame.clear()
  }

  get moveX(): number {
    let v = 0
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) v -= 1
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) v += 1
    return v
  }

  get moveY(): number {
    let v = 0
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) v -= 1
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) v += 1
    return v
  }

  get swingPressed(): boolean {
    return this.wasPressed('Space')
  }

  get skill1Pressed(): boolean {
    return this.wasPressed('KeyJ')
  }

  get skill2Pressed(): boolean {
    return this.wasPressed('KeyK')
  }

  get megaPressed(): boolean {
    return this.wasPressed('KeyL')
  }

  get pausePressed(): boolean {
    return this.wasPressed('Escape')
  }

  get confirmPressed(): boolean {
    return this.wasPressed('Enter') || this.wasPressed('Space')
  }
}

export const input = new InputManager()
