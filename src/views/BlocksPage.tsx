import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { StartProjectBlock } from '../components/hero/StartProjectBlock'
import { ReactiveThreeBackground } from '../components/hero/ReactiveThreeBackground'
import { TitleBlock } from '../components/hero/TitleBlock'
import { ElectricGuideLines } from '../components/motion/ElectricGuideLines'
import electricGuideLinesSource from '../components/motion/ElectricGuideLines.tsx?raw'
import reactiveThreeBackgroundSource from '../components/hero/ReactiveThreeBackground.tsx?raw'
import titleBlockSource from '../components/hero/TitleBlock.tsx?raw'
import wordShiftButtonSource from '../components/ui/WordShiftButton.tsx?raw'

type View = 'preview' | 'code' | 'prompt'

type BlockCardProps = {
  name: string
  category: string
  description: string
  prompt: string
  code: string
  children: ReactNode
  previewTheme?: 'light' | 'dark'
}

function BlockCard({ name, category, description, prompt, code, children, previewTheme = 'light' }: BlockCardProps) {
  const [view, setView] = useState<View>('preview')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard?.writeText(view === 'prompt' ? prompt : code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <article className="block-card">
      <header className="block-card__heading">
        <div>
          <div className="block-card__title-row">
            <h2>{name}</h2>
            <span className="block-badge block-badge--free">Free</span>
            <span className="block-badge block-badge--new">New</span>
          </div>
          <p>{description}</p>
        </div>
        <span className="block-card__category">{category}</span>
      </header>

      <div className="block-card__shell">
        <div className="block-card__toolbar">
          <div className="block-card__tabs" role="tablist" aria-label={`${name} views`}>
            {(['preview', 'code', 'prompt'] as const).map((item) => (
              <button className={view === item ? 'is-active' : ''} onClick={() => setView(item)} type="button" key={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          {view !== 'preview' && <button className="block-card__copy" onClick={copy} type="button">{copied ? 'Copied' : 'Copy'}</button>}
        </div>
        {view === 'preview'
          ? <div className={`block-card__preview block-card__preview--${previewTheme}`}>{children}</div>
          : <pre className="block-card__code"><code>{view === 'code' ? code : prompt}</code></pre>}
      </div>
    </article>
  )
}

const blocks = [
  {
    name: 'Kinetic Title 01', category: 'Typography',
    description: 'Blur reveal with a rotating final phrase.',
    code: titleBlockSource,
    prompt: 'Create a kinetic editorial title that reads “Designed to mean something.” Use blurred character reveals and rotate the final word every 3 seconds.',
    preview: <TitleBlock className="blocks-preview__title" />,
  },
  {
    name: 'Project CTA 01', category: 'Call to action',
    description: 'Minimal text link with directional motion.',
    code: wordShiftButtonSource,
    prompt: 'Create a minimal text CTA for a creative studio. On hover, shift the letters as a group, swap the arrow direction, and draw an underline from the opposite side.',
    preview: <StartProjectBlock className="blocks-preview__button" />,
  },
  {
    name: 'Electric Guide Lines 01', category: 'Canvas interaction',
    description: 'Touch a guide line to send a short electrical arc across the field.',
    code: electricGuideLinesSource,
    prompt: 'Create three subtle animated guide lines on a dark canvas. When the pointer touches a line, emit a short layered electrical arc toward another line.',
    preview: <ElectricGuideLines />,
    previewTheme: 'dark' as const,
  },
  {
    name: 'Reactive 3D Mark 01', category: 'Three.js interaction',
    description: 'A metallic 3D mark that idles, follows the pointer, and flashes on contact.',
    code: reactiveThreeBackgroundSource,
    prompt: 'Create a full-bleed Three.js background with a metallic geometric mark. Add slow idle rotation, pointer parallax, and raycast-driven panel highlights.',
    preview: <ReactiveThreeBackground />,
    previewTheme: 'dark' as const,
  },
]

export function BlocksPage() {
  const [query, setQuery] = useState('')
  const visibleBlocks = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return blocks
    return blocks.filter((block) => `${block.name} ${block.category}`.toLowerCase().includes(value))
  }, [query])

  return (
    <main className="blocks-page">
      <header className="blocks-header">
        <div className="blocks-container blocks-header__inner">
          <a className="blocks-brand" href="/">LUNA<span>Blocks</span></a>
          <nav><a href="/#cases">Cases</a><a className="is-current" href="/blocks">Blocks</a><a href="/playgrounds">Playgrounds</a></nav>
          <a className="blocks-header__action" href="/copies/trionn">Open copy</a>
        </div>
      </header>

      <section className="blocks-hero">
        <div className="blocks-container">
          <div className="blocks-breadcrumb"><a href="/">Home</a><span>/</span><span>Blocks</span></div>
          <h1>Free motion blocks</h1>
          <p>Production-ready motion components for React. Preview, copy, and adapt them to your interface.</p>
        </div>
      </section>

      <div className="blocks-filter">
        <div className="blocks-container blocks-filter__inner">
          <button className="blocks-filter__all" type="button"><span>▦</span> All blocks <b>{blocks.length}</b></button>
          <label className="blocks-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search blocks..." /></label>
          <div className="blocks-sort"><span>Sort by</span><select aria-label="Sort blocks"><option>Newest</option><option>Name</option></select></div>
        </div>
      </div>

      <section className="blocks-container blocks-list" aria-label="Component blocks">
        {visibleBlocks.map((block) => <BlockCard key={block.name} {...block}>{block.preview}</BlockCard>)}
        {visibleBlocks.length === 0 && <p className="blocks-empty">No blocks match “{query}”.</p>}
      </section>
      <footer className="blocks-footer"><div className="blocks-container"><span>LUNA Blocks</span><span>React / GSAP / CSS</span></div></footer>
    </main>
  )
}
