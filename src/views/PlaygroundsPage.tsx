import { useState } from 'react'
import { MaterialLightPlayground } from '../components/playground/MaterialLightPlayground'

const playgrounds = [
  {
    id: 'material-light',
    index: '01',
    name: 'Material & Light',
    category: 'Three.js',
  },
]

export function PlaygroundsPage() {
  const [activeId, setActiveId] = useState(playgrounds[0].id)
  const active = playgrounds.find((item) => item.id === activeId) ?? playgrounds[0]

  return (
    <main className="playgrounds-page">
      <header className="playgrounds-header">
        <a className="playgrounds-brand" href="/">LUNA<span>Playground</span></a>
        <nav><a href="/#cases">Cases</a><a href="/blocks">Blocks</a><a className="is-current" href="/playgrounds">Playgrounds</a></nav>
        <a className="playgrounds-header__action" href="/copies/trionn">Open copy</a>
      </header>

      <div className="playgrounds-layout">
        <aside className="playgrounds-sidebar">
          <div className="playgrounds-sidebar__heading"><span>Playgrounds</span><b>{playgrounds.length}</b></div>
          <nav aria-label="Playground list">
            {playgrounds.map((item) => (
              <button className={activeId === item.id ? 'is-active' : ''} type="button" onClick={() => setActiveId(item.id)} key={item.id}>
                <span>{item.index}</span>
                <strong>{item.name}</strong>
                <small>{item.category}</small>
              </button>
            ))}
          </nav>
        </aside>

        <section className="playgrounds-workspace" aria-labelledby="playground-title">
          <header className="playgrounds-workspace__heading">
            <div><span>{active.index} / {active.category}</span><h1 id="playground-title">{active.name}</h1></div>
          </header>
          {active.id === 'material-light' && <MaterialLightPlayground />}
        </section>
      </div>
    </main>
  )
}
