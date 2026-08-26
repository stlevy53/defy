import { afterEach, describe, expect, it } from 'vitest'
import type { StorageLike } from './coachLaunch'
import {
  DEFAULT_VOLUME,
  SOUND_MUTED_KEY,
  SOUND_VOLUME_KEY,
  actionSfx,
  configureAudio,
  endgameCue,
  flightSfx,
  getVolume,
  isMuted,
  playEndgameSfx,
  playSfx,
  resetAudioForTests,
  setMuted,
  setVolume,
  unlock,
} from './audio'

function mem(init: Record<string, string> = {}): StorageLike {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v)
    },
  }
}

afterEach(() => resetAudioForTests())

describe('mute / volume persistence', () => {
  it('defaults to on at a quiet-ish volume', () => {
    const s = mem()
    expect(isMuted(s)).toBe(false)
    expect(getVolume(s)).toBe(DEFAULT_VOLUME)
  })

  it('round-trips mute and volume through an injected map', () => {
    const s = mem()
    setMuted(true, s)
    setVolume(0.3, s)
    expect(s.getItem(SOUND_MUTED_KEY)).toBe('1')
    expect(s.getItem(SOUND_VOLUME_KEY)).toBe('0.3')
    expect(isMuted(s)).toBe(true)
    expect(getVolume(s)).toBe(0.3)
    setMuted(false, s)
    expect(isMuted(s)).toBe(false)
  })

  it('clamps volume to 0–1', () => {
    const s = mem()
    setVolume(2, s)
    expect(getVolume(s)).toBe(1)
    setVolume(-4, s)
    expect(getVolume(s)).toBe(0)
  })

  it('treats junk stored volume as the default', () => {
    expect(getVolume(mem({ [SOUND_VOLUME_KEY]: 'nope' }))).toBe(DEFAULT_VOLUME)
  })
})

describe('playSfx', () => {
  it('no-ops until unlocked, when muted, or when the file is missing', () => {
    const played: string[] = []
    const s = mem()
    configureAudio({
      urls: { play: 'play.wav' },
      play: (url) => played.push(url),
      storage: s,
    })
    playSfx('play')
    expect(played).toEqual([])
    unlock()
    playSfx('draw')
    expect(played).toEqual([])
    setMuted(true, s)
    playSfx('play')
    expect(played).toEqual([])
    setMuted(false, s)
    playSfx('play')
    expect(played).toEqual(['play.wav'])
  })

  it('resolves cues through the real filenames (Card Flip, Gunshot, …)', () => {
    const played: string[] = []
    configureAudio({
      urls: { 'Card Flip': 'Card Flip.mp3', Gunshot: 'Gunshot.mp3' },
      play: (url) => played.push(url),
      storage: mem(),
    })
    unlock()
    playSfx('play')
    playSfx('strike')
    expect(played).toEqual(['Card Flip.mp3', 'Gunshot.mp3'])
  })

  it('maps the civilian-death cue to its own file', () => {
    const played: string[] = []
    configureAudio({
      urls: { 'Civilian Death': 'Civilian Death.mp3' },
      play: (url) => played.push(url),
      storage: mem(),
    })
    unlock()
    playSfx('civilian')
    expect(played).toEqual(['Civilian Death.mp3'])
  })

  it('scales the one-shot by master volume × gain', () => {
    const vols: number[] = []
    const s = mem()
    configureAudio({
      urls: { strike: 'strike.wav' },
      play: (_url, vol) => vols.push(vol),
      storage: s,
    })
    unlock()
    setVolume(0.5, s)
    playSfx('strike', { gain: 0.4 })
    expect(vols).toEqual([0.2])
  })
})

describe('flightSfx', () => {
  it('uses the card flip for any hand flight, and a slash when a Spy leaves', () => {
    expect(flightSfx({ discard: true, draw: true })).toBe('play')
    expect(flightSfx({ discard: true, draw: false })).toBe('play')
    expect(flightSfx({ discard: false, draw: true })).toBe('play')
    expect(flightSfx({ discard: false, draw: false, other: true })).toBe('play')
    expect(flightSfx({ discard: true, draw: true, spyLeft: true })).toBe('slash')
    expect(flightSfx({ discard: false, draw: false })).toBe(null)
  })
})

describe('actionSfx', () => {
  const missions = ['m1', 'm2']

  it('flips a card for play and rearrange; a dedicated sting for choosing a Mission', () => {
    expect(actionSfx({ type: 'PlayMaquis', uid: 'a', side: 'hidden' }, missions)).toBe('play')
    expect(actionSfx({ type: 'MoveMaquis', uid: 'a', side: 'revealed' }, missions)).toBe('play')
    expect(actionSfx({ type: 'ChooseMission', uid: 'm1' }, missions)).toBe('choose')
  })

  it('fires a gunshot on an Enemy and an explosion on the Mission', () => {
    expect(actionSfx({ type: 'SpendAttackOn', targetUid: 'enemy-1' }, missions)).toBe('strike')
    expect(actionSfx({ type: 'SpendAttackOn', targetUid: 'm1' }, missions)).toBe('defeat')
  })

  it('stays silent for phase advance', () => {
    expect(actionSfx({ type: 'AdvancePhase' }, missions)).toBe(null)
  })
})

describe('end-game stingers', () => {
  it('picks a file per outcome and fires once per overlay key', () => {
    expect(endgameCue('loss')).toBe('loss')
    expect(endgameCue('win', 'Draw')).toBe('winDraw')
    expect(endgameCue('win', 'Minor Victory')).toBe('winMinor')
    expect(endgameCue('win', 'Victory')).toBe('winVictory')
    expect(endgameCue('win', 'Major Victory')).toBe('winMajor')
    expect(endgameCue('win', 'Epic Victory')).toBe('winEpic')

    const played: string[] = []
    configureAudio({
      urls: {
        'Defeat Audio': 'Defeat Audio.mp3',
        'Draw Audio': 'Draw Audio.mp3',
        'Overwhelming Victory Audio': 'Overwhelming Victory Audio.mp3',
      },
      play: (url) => played.push(url),
      storage: mem(),
    })
    unlock()
    playEndgameSfx('loss', 'g1-loss')
    playEndgameSfx('loss', 'g1-loss')
    expect(played).toEqual(['Defeat Audio.mp3'])
    playEndgameSfx('win', 'g1-win', { tier: 'Draw' })
    playEndgameSfx('win', 'g2-epic', { tier: 'Epic Victory' })
    expect(played).toEqual([
      'Defeat Audio.mp3',
      'Draw Audio.mp3',
      'Overwhelming Victory Audio.mp3',
    ])
  })
})
