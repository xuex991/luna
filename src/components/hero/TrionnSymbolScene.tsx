import type { MutableRefObject } from 'react'
import type { HeroRuntimeState } from './runtime'
import { useTrionnSymbolScene, type ThreeControls, type TrionnLightingControls } from '../../hooks/useTrionnSymbolScene'

type TrionnSymbolSceneProps = {
  controls: ThreeControls
  runtime: MutableRefObject<HeroRuntimeState>
  showGuides?: boolean
  showSymbol?: boolean
  enableBlast?: boolean
  enableAudio?: boolean
  soundEnabled?: boolean
  toneMappingExposure?: number
  lightingControls?: TrionnLightingControls
  vibrateElementIds?: string[]
}

/** Main entry point for the Trionn symbol background scene. */
export function TrionnSymbolScene({ controls, runtime, showGuides, showSymbol, enableBlast, enableAudio, soundEnabled, toneMappingExposure, lightingControls, vibrateElementIds }: TrionnSymbolSceneProps) {
  const hostRef = useTrionnSymbolScene({ controls, runtime, showGuides, showSymbol, enableBlast, enableAudio, soundEnabled, toneMappingExposure, lightingControls, vibrateElementIds })
  return <div ref={hostRef} className="three-mark" aria-label="Three-dimensional geometric mark" />
}
