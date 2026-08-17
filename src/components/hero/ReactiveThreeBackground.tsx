import { useRef } from 'react'
import type { HeroRuntimeState } from './runtime'
import { TRIONN_SCENE_CONTROLS } from './sceneConfig'
import { TrionnSymbolScene } from './TrionnSymbolScene'

/** Standalone 3D mark with idle rotation, pointer parallax and panel highlights. */
export function ReactiveThreeBackground() {
  const runtime = useRef<HeroRuntimeState>({ transitionReady: true, explodeAmt: 0 })

  return (
    <div className="reactive-three-background">
      <TrionnSymbolScene
        controls={TRIONN_SCENE_CONTROLS}
        runtime={runtime}
        showGuides={false}
      />
    </div>
  )
}
