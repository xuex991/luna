import type { MutableRefObject } from 'react'
import type { HeroRuntimeState } from './runtime'
import { useTrionnSymbolScene, type ThreeControls } from '../../hooks/useTrionnSymbolScene'

type TrionnSymbolSceneProps = {
  controls: ThreeControls
  runtime: MutableRefObject<HeroRuntimeState>
}

/** Main entry point for the Trionn symbol background scene. */
export function TrionnSymbolScene({ controls, runtime }: TrionnSymbolSceneProps) {
  const hostRef = useTrionnSymbolScene({ controls, runtime })
  return <div ref={hostRef} className="three-mark" aria-label="Three-dimensional geometric mark" />
}
