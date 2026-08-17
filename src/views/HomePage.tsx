import { useEffect, useRef, useState } from 'react'
import type { HeroRuntimeState } from '../components/hero/runtime'
import { StartProjectBlock, TitleBlock, TrionnSymbolScene } from '../components/hero'
import { TRIONN_SCENE_CONTROLS } from '../components/hero/sceneConfig'
import { BlurTextReveal } from '../components/motion/BlurTextReveal'

const HERO_WORDS = ['something.', 'depth.', 'impact.', 'purpose.', 'intention.']
const BLAST_REACTIVE_IDS = ['hero-nav', 'hero-copy', 'hero-stats', 'hero-prompt', 'hero-scroll']

export function HomePage() {
  const runtime = useRef<HeroRuntimeState>({ transitionReady: false, explodeAmt: 0 })
  const [transitionReady, setTransitionReady] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const toggleSound = () => {
    const enabled = !soundEnabled
    setSoundEnabled(enabled)
    window.dispatchEvent(new CustomEvent('trionn-sound-change', { detail: { enabled } }))
  }

  useEffect(() => {
    let cancelled = false
    let frameId = 0
    let settleFrameId = 0

    const markReady = () => {
      if (cancelled) return
      runtime.current.transitionReady = true
      setTransitionReady(true)
    }

    // Treat the first two paints as the page-transition settle point. The
    // symbol scene schedules its heavier, non-critical work independently.
    frameId = window.requestAnimationFrame(() => {
      settleFrameId = window.requestAnimationFrame(markReady)
    })

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frameId)
      window.cancelAnimationFrame(settleFrameId)
    }
  }, [])

  return (
    <main className="hero" aria-labelledby="hero-title">
      <div className="hero__background" aria-hidden="true">
        <TrionnSymbolScene controls={TRIONN_SCENE_CONTROLS} runtime={runtime} soundEnabled={soundEnabled} vibrateElementIds={BLAST_REACTIVE_IDS} />
      </div>

      <div className="hero__foreground">
        <header id="hero-nav" className="hero__nav">
          <a className="hero__logo" href="/copies/trionn" aria-label="TRIONN hero copy">TRIONN<sup>®</sup></a>
          <div className="hero__nav-actions">
            <button
              className={`hero__sound${soundEnabled ? ' is-active' : ''}`}
              type="button"
              aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Mute sound' : 'Enable sound'}
              onClick={toggleSound}
            >
              <span aria-hidden="true"><i /><i /><i /></span>
            </button>
            <a className="hero__talk" href="/">Back to LUNA</a>
            <button className="hero__menu" type="button" aria-label="Open menu">
              <span>Menu</span>
              <i aria-hidden="true" />
            </button>
          </div>
        </header>

        <section id="hero-copy" className="hero__copy">
          <TitleBlock className="hero__headline" words={HERO_WORDS} active={transitionReady} />
          <StartProjectBlock href="#contact" />
        </section>

        <aside id="hero-stats" className="hero__stats" aria-label="Studio information">
          <div className="hero__stats-card">
            <span className="hero__globe" aria-hidden="true">◎</span>
            <BlurTextReveal
              text="Est. 2012"
              animationType="words"
              stagger={0.08}
              delay={0.35}
              active={transitionReady}
            />
          </div>
          <BlurTextReveal
            as="p"
            text="14+ years shaping digital direction."
            animationType="lines"
            stagger={0.12}
            delay={0.45}
            active={transitionReady}
          />
          <BlurTextReveal
            as="p"
            className="hero__description"
            text="Websites, AI products, brands, systems built for clarity, scale and impact."
            animationType="words"
            stagger={0.025}
            delay={0.55}
            active={transitionReady}
          />
        </aside>

        <div id="hero-prompt" className="hero__prompt" aria-hidden="true">
          <span>Hold to <b>✹</b> blast</span>
          <span>Dare <b>ϟ</b> to touch the lines.</span>
        </div>

        <a id="hero-scroll" className="hero__scroll" href="#case-study" aria-label="Read the case study">↓</a>
      </div>
    </main>
  )
}
