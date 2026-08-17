import { useRef } from 'react'
import { TRIONN_SCENE_CONTROLS } from '../hero/sceneConfig'
import type { HeroRuntimeState } from '../hero/runtime'
import { TrionnSymbolScene } from '../hero/TrionnSymbolScene'

/** The production guide-line and weld effect, isolated from the hero symbol. */
export function ElectricGuideLines() {
  const runtime = useRef<HeroRuntimeState>({ transitionReady: true, explodeAmt: 0 })

  return (
    <div className="electric-guide-lines">
      <TrionnSymbolScene
        controls={TRIONN_SCENE_CONTROLS}
        runtime={runtime}
        showSymbol={false}
        enableBlast={false}
      />
    </div>
  )
}
