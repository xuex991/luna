import { useMemo, useRef, useState } from 'react'
import {
  TRIONN_LIGHT_DEFINITIONS,
  type TrionnLightControl,
  type TrionnLightId,
  type TrionnLightingControls,
} from '../../hooks/useTrionnSymbolScene'
import { TRIONN_SCENE_CONTROLS } from '../hero/sceneConfig'
import type { HeroRuntimeState } from '../hero/runtime'
import { TrionnSymbolScene } from '../hero/TrionnSymbolScene'

type MaterialSettings = {
  metalness: number
  roughness: number
  transmission: number
  clearcoat: number
}

const PRODUCTION_SETTINGS: MaterialSettings = {
  metalness: TRIONN_SCENE_CONTROLS.metalness,
  roughness: TRIONN_SCENE_CONTROLS.roughness,
  transmission: TRIONN_SCENE_CONTROLS.transmission,
  clearcoat: TRIONN_SCENE_CONTROLS.clearcoat,
}

const PRESETS: Record<string, MaterialSettings> = {
  Production: PRODUCTION_SETTINGS,
  Plastic: { metalness: 0, roughness: 0.28, transmission: 0, clearcoat: 0.35 },
  'Polished metal': { metalness: 1, roughness: 0.04, transmission: 0, clearcoat: 1 },
  'Brushed metal': { metalness: 1, roughness: 0.58, transmission: 0, clearcoat: 0.25 },
  Glass: { metalness: 0, roughness: 0.06, transmission: 0.9, clearcoat: 1 },
}

const createProductionLights = () => Object.fromEntries(
  TRIONN_LIGHT_DEFINITIONS.map(({ id, color, intensity, position }) => [
    id,
    { enabled: true, color, intensity, position: [...position] as [number, number, number] },
  ]),
) as Record<TrionnLightId, TrionnLightControl>

const colorToHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`
const PRODUCTION_EXPOSURE = 1.1
const PRODUCTION_BACKGROUND = 0x0c0c0c

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  disabled?: boolean
}

function Slider({ label, value, min, max, step, onChange, disabled = false }: SliderProps) {
  return (
    <label className={`playground-slider${disabled ? ' is-disabled' : ''}`}>
      <span><b>{label}</b><output>{value.toFixed(step < 1 ? 2 : 0)}</output></span>
      <input disabled={disabled} value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} type="range" />
    </label>
  )
}

export function MaterialLightPlayground() {
  const runtime = useRef<HeroRuntimeState>({ transitionReady: true, explodeAmt: 0 })
  const [settings, setSettings] = useState<MaterialSettings>({ ...PRODUCTION_SETTINGS })
  const [preset, setPreset] = useState('Production')
  const [rotating, setRotating] = useState(true)
  const [selectedLightId, setSelectedLightId] = useState<TrionnLightId>('key')
  const [lights, setLights] = useState(createProductionLights)
  const [soloLight, setSoloLight] = useState<TrionnLightId | null>(null)
  const [animateMovingLights, setAnimateMovingLights] = useState(true)
  const [exposure, setExposure] = useState(PRODUCTION_EXPOSURE)
  const [backgroundColor, setBackgroundColor] = useState(PRODUCTION_BACKGROUND)

  const selectedDefinition = TRIONN_LIGHT_DEFINITIONS.find(({ id }) => id === selectedLightId)!
  const selectedLight = lights[selectedLightId]
  const manualPositionDisabled = Boolean(selectedDefinition.moving && animateMovingLights)

  const lightingControls = useMemo<TrionnLightingControls>(() => ({
    lights,
    soloLight,
    animateMovingLights,
    exposure,
    backgroundColor,
  }), [animateMovingLights, backgroundColor, exposure, lights, soloLight])

  const setValue = (key: keyof MaterialSettings, value: number) => {
    setPreset('Custom')
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const selectPreset = (name: string) => {
    const next = PRESETS[name]
    if (!next) return
    setPreset(name)
    setSettings({ ...next })
  }

  const updateSelectedLight = (update: Partial<TrionnLightControl>) => {
    setLights((current) => ({
      ...current,
      [selectedLightId]: { ...current[selectedLightId], ...update },
    }))
  }

  const updatePosition = (axis: number, value: number) => {
    const position = [...selectedLight.position] as [number, number, number]
    position[axis] = value
    updateSelectedLight({ position })
  }

  const resetLighting = () => {
    setLights(createProductionLights())
    setSoloLight(null)
    setAnimateMovingLights(true)
    setExposure(PRODUCTION_EXPOSURE)
    setBackgroundColor(PRODUCTION_BACKGROUND)
  }

  const resetAll = () => {
    selectPreset('Production')
    setRotating(true)
    resetLighting()
  }

  const controls = {
    ...TRIONN_SCENE_CONTROLS,
    ...settings,
    rotationSpeed: rotating ? TRIONN_SCENE_CONTROLS.rotationSpeed : 0,
  }

  return (
    <div className="material-playground">
      <div className="material-playground__viewport">
        <TrionnSymbolScene
          controls={controls}
          runtime={runtime}
          showGuides={false}
          enableBlast={false}
          enableAudio={false}
          lightingControls={lightingControls}
        />
      </div>
      <aside className="material-playground__controls">
        <div className="material-playground__control-row">
          <label>
            <span>Material preset</span>
            <select value={preset} onChange={(event) => selectPreset(event.target.value)}>
              {preset === 'Custom' && <option>Custom</option>}
              {Object.keys(PRESETS).map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <button type="button" onClick={resetAll}>Reset all</button>
        </div>

        <div className="material-playground__section">
          <h2>Material</h2>
          <Slider label="Metalness" value={settings.metalness} min={0} max={1} step={0.01} onChange={(value) => setValue('metalness', value)} />
          <Slider label="Roughness" value={settings.roughness} min={0.02} max={1} step={0.01} onChange={(value) => setValue('roughness', value)} />
          <Slider label="Transmission" value={settings.transmission} min={0} max={1} step={0.01} onChange={(value) => setValue('transmission', value)} />
          <Slider label="Clearcoat" value={settings.clearcoat} min={0} max={1} step={0.01} onChange={(value) => setValue('clearcoat', value)} />
        </div>

        <div className="material-playground__section">
          <h2>Environment</h2>
          <label className="material-playground__color">
            <span><b>Background</b><output>{colorToHex(backgroundColor).toUpperCase()}</output></span>
            <input type="color" value={colorToHex(backgroundColor)} onChange={(event) => setBackgroundColor(Number.parseInt(event.target.value.slice(1), 16))} />
          </label>
          <Slider label="Exposure" value={exposure} min={0.2} max={3} step={0.05} onChange={setExposure} />
        </div>

        <div className="material-playground__section material-playground__lighting">
          <div className="material-playground__section-heading">
            <h2>Lights <span>13</span></h2>
            <button type="button" onClick={resetLighting}>Reset lights</button>
          </div>
          <label className="material-playground__field">
            <span>Selected light</span>
            <select value={selectedLightId} onChange={(event) => setSelectedLightId(event.target.value as TrionnLightId)}>
              {TRIONN_LIGHT_DEFINITIONS.map(({ id, name, kind, moving }) => (
                <option value={id} key={id}>{name} · {kind}{moving ? ' · moving' : ''}</option>
              ))}
            </select>
          </label>

          <div className="material-playground__switches">
            <label>
              <input type="checkbox" checked={selectedLight.enabled} onChange={(event) => updateSelectedLight({ enabled: event.target.checked })} />
              <span>Enabled</span>
            </label>
            <label>
              <input type="checkbox" checked={soloLight === selectedLightId} onChange={(event) => setSoloLight(event.target.checked ? selectedLightId : null)} />
              <span>Solo</span>
            </label>
          </div>

          <label className="material-playground__color">
            <span><b>Color</b><output>{colorToHex(selectedLight.color).toUpperCase()}</output></span>
            <input type="color" value={colorToHex(selectedLight.color)} onChange={(event) => updateSelectedLight({ color: Number.parseInt(event.target.value.slice(1), 16) })} />
          </label>
          <Slider
            label="Intensity"
            value={selectedLight.intensity}
            min={0}
            max={selectedDefinition.kind === 'point' ? 20 : 5}
            step={0.05}
            onChange={(intensity) => updateSelectedLight({ intensity })}
          />

          {selectedDefinition.kind !== 'ambient' && (
            <div className="material-playground__position">
              <div className="material-playground__position-heading">
                <b>Position</b>
                {manualPositionDisabled && <span>Automatic</span>}
              </div>
              {(['X', 'Y', 'Z'] as const).map((axis, index) => (
                <Slider key={axis} label={axis} value={selectedLight.position[index]} min={-10} max={10} step={0.1} disabled={manualPositionDisabled} onChange={(value) => updatePosition(index, value)} />
              ))}
            </div>
          )}

          <label className="material-playground__toggle">
            <input type="checkbox" checked={animateMovingLights} onChange={(event) => setAnimateMovingLights(event.target.checked)} />
            <span>Animate moving lights</span>
          </label>
        </div>

        <label className="material-playground__toggle">
          <input type="checkbox" checked={rotating} onChange={(event) => setRotating(event.target.checked)} />
          <span>Auto rotate symbol</span>
        </label>
      </aside>
    </div>
  )
}
