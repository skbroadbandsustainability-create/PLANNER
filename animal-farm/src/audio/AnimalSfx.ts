import type { SpeciesDef } from '../core/types.ts'

const MAX_AUDIBLE_DISTANCE = 26

/**
 * 동물 울음소리 효과음.
 * 별도의 오디오 파일 없이 Web Audio API 오실레이터로 종별로 다른 "울음소리"를 즉석에서 합성한다.
 * (배경음악은 사용하지 않는다는 기획에 맞춰 SFX만 존재)
 */
export class AnimalSfx {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  muted = false

  /** 사용자 제스처(클릭/키 입력) 이후에 호출해서 오디오 컨텍스트를 활성화한다. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new Ctor()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.5
    this.masterGain.connect(this.ctx.destination)
  }

  /** distance가 클수록 소리가 작아지고, 일정 거리를 넘으면 재생하지 않는다. */
  playCry(species: SpeciesDef, distance = 0): void {
    if (this.muted || !this.ctx || !this.masterGain) return
    if (distance > MAX_AUDIBLE_DISTANCE) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const volume = 0.5 * (1 - distance / MAX_AUDIBLE_DISTANCE) + 0.08

    const osc = ctx.createOscillator()
    osc.type = species.cryType
    const startFreq = species.cryFreq * 1.18
    const endFreq = species.cryFreq * 0.8
    osc.frequency.setValueAtTime(startFreq, now)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + species.cryLength)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.05, volume), now + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + species.cryLength + 0.05)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + species.cryLength + 0.08)
  }
}
