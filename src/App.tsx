import { maquis, missions, enemyTypes, civilians, spyCount } from './data'

/** Phase 0 placeholder UI: confirms the toolchain runs and the card data is wired in. */
export function App() {
  const enemyTotal = enemyTypes.reduce((sum, t) => sum + t.count, 0)
  const stats = [
    { label: 'Maquis', value: maquis.length },
    { label: 'Missions', value: missions.length },
    { label: 'Enemies', value: enemyTotal },
    { label: 'Civilians', value: civilians.length },
    { label: 'Spies', value: spyCount },
  ]

  return (
    <main>
      <h1>Resist! — DEFY</h1>
      <p>Phase 0 scaffold. Card data loaded from <code>/data</code>:</p>
      <ul>
        {stats.map((s) => (
          <li key={s.label}>
            <strong>{s.value}</strong> {s.label}
          </li>
        ))}
      </ul>
      <p>Next: the rules engine (Phase 2).</p>
    </main>
  )
}
