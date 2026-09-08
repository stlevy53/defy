import { describe, expect, it } from 'vitest'
import { createGame } from '../engine'
import {
  facedownClickMessage,
  hiddenDiscardSpyCount,
  inspectUids,
  pileViews,
  spySupplyCount,
} from './pileInspect'
import { classifyCandidate } from './format'

describe('pileViews', () => {
  it('marks face-up piles inspectable and face-down decks not', () => {
    const s = createGame({ seed: 1 })
    const byId = Object.fromEntries(pileViews(s).map((p) => [p.id, p]))
    expect(byId['hidden.discard'].inspect).toBe(true)
    expect(byId['recruit.revealed'].inspect).toBe(true)
    expect(byId['enemy.discard'].inspect).toBe(true)
    expect(byId['defeated'].inspect).toBe(true)
    expect(byId['graveyard'].inspect).toBe(true)
    expect(byId['removed'].inspect).toBe(true)
    expect(byId['spy.supply'].inspect).toBe(true)
    expect(byId['hidden.deck'].inspect).toBe(false)
    expect(byId['recruit.deck'].inspect).toBe(false)
    expect(byId['enemy.deck'].inspect).toBe(false)
    expect(byId['mission.deck'].inspect).toBe(false)
  })

  it('keeps Hidden discard on the status bar next to Hidden deck', () => {
    const s = createGame({ seed: 1 })
    const inline = pileViews(s).filter((p) => p.inline).map((p) => p.id)
    expect(inline).toEqual(['hidden.deck', 'hidden.discard', 'enemy.deck', 'mission.deck', 'graveyard'])
  })

  it('puts a Spy count on Hidden discard', () => {
    const s = createGame({ seed: 1 })
    s.hidden.discard.push({ uid: 's1', dataId: 'spy' }, { uid: 'm1', dataId: 'celia' })
    const discard = pileViews(s).find((p) => p.id === 'hidden.discard')
    expect(discard?.spyCount).toBe(1)
    expect(discard?.n).toBe(2)
  })
})

describe('inspectUids', () => {
  it('lists Hidden discard newest first', () => {
    const s = createGame({ seed: 1 })
    s.hidden.discard.push({ uid: 'older', dataId: 'celia' }, { uid: 'newer', dataId: 'spy' })
    expect(inspectUids(s, 'hidden.discard')).toEqual(['newer', 'older'])
    expect(hiddenDiscardSpyCount(s)).toBe(1)
  })

  it('does not expose face-down decks', () => {
    const s = createGame({ seed: 1 })
    expect(inspectUids(s, 'hidden.deck')).toEqual([])
    expect(inspectUids(s, 'enemy.deck')).toEqual([])
    expect(inspectUids(s, 'mission.deck')).toEqual([])
    expect(inspectUids(s, 'recruit.deck')).toEqual([])
  })

  it('classifies a defeated Mission and a Graveyard civilian from their piles', () => {
    const s = createGame({ seed: 1 })
    const mission = s.missionRow[0]
    s.defeatedMissions.push({ uid: mission.uid + '-won', dataId: mission.dataId })
    const [won] = inspectUids(s, 'defeated')
    expect(classifyCandidate(s, won).kind).toBe('mission')

    const civ = s.civilianDeck[0]
    s.graveyard.push(civ)
    expect(classifyCandidate(s, civ.uid).kind).toBe('civilian')
  })
})

describe('facedownClickMessage', () => {
  it('names the deck so a missed click does not look broken', () => {
    expect(facedownClickMessage('Hidden deck')).toMatch(/Hidden deck is face-down/)
    expect(facedownClickMessage('Enemy deck')).toMatch(/dealt or drawn|lets you look/i)
    expect(pileViews(createGame({ seed: 1 })).find((p) => p.id === 'hidden.deck')?.hint).toMatch(/Click to see why/)
  })
})

describe('spy supply', () => {
  it('reports the face-up leftover Spies as a count, not a hidden deck', () => {
    const s = createGame({ seed: 1 })
    expect(spySupplyCount(s)).toBe(3)
    expect(inspectUids(s, 'spy.supply')).toEqual([])
  })
})
