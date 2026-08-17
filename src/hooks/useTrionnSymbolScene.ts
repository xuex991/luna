import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { createTrionnShapes } from '../components/hero/TrionnMark'
import type { HeroRuntimeState } from '../components/hero/runtime'

export type ThreeControls = {
  cameraFov: number
  cameraZ: number
  metalness: number
  roughness: number
  transmission: number
  clearcoat: number
  lightIntensity: number
  keyLightAngle: number
  rotationSpeed: number
}

export type TrionnLightId = 'ambient' | 'key' | 'coolBack' | 'cool' | 'edge' | 'front' | 'left' | 'right' | 'bottom' | 'top' | 'fill' | 'warmFill' | 'warmTop'
export type TrionnLightControl = { enabled: boolean; intensity: number; color: number; position: [number, number, number] }
export type TrionnLightingControls = {
  lights: Record<TrionnLightId, TrionnLightControl>
  soloLight: TrionnLightId | null
  animateMovingLights: boolean
  exposure: number
  backgroundColor: number
}

export const TRIONN_LIGHT_DEFINITIONS: Array<{
  id: TrionnLightId
  name: string
  kind: 'ambient' | 'directional' | 'point'
  color: number
  intensity: number
  position: [number, number, number]
  moving?: boolean
}> = [
  { id: 'ambient', name: 'Ambient', kind: 'ambient', color: 0x2a3040, intensity: 2.8, position: [0, 0, 0] },
  { id: 'key', name: 'Key', kind: 'directional', color: 0xffffff, intensity: 1.6, position: [4, 5, 4] },
  { id: 'coolBack', name: 'Cool back', kind: 'directional', color: 0x8899aa, intensity: 0.8, position: [-4, 1, -2] },
  { id: 'cool', name: 'Cool', kind: 'directional', color: 0xccddee, intensity: 1.5, position: [0, -3, -5] },
  { id: 'edge', name: 'Edge', kind: 'directional', color: 0x8899aa, intensity: 1, position: [-3, 2, 6] },
  { id: 'front', name: 'Front', kind: 'directional', color: 0x6677aa, intensity: 1.2, position: [0, 0, -8] },
  { id: 'left', name: 'Left', kind: 'directional', color: 0x6677aa, intensity: 1, position: [-8, 0, 0] },
  { id: 'right', name: 'Right', kind: 'directional', color: 0x6677aa, intensity: 1, position: [8, 0, 0] },
  { id: 'bottom', name: 'Bottom', kind: 'directional', color: 0x6677aa, intensity: 1, position: [0, -8, 0] },
  { id: 'top', name: 'Top', kind: 'directional', color: 0xaabbcc, intensity: 1, position: [0, 8, 2] },
  { id: 'fill', name: 'Fill', kind: 'point', color: 0xff3300, intensity: 12, position: [3, -1, 3], moving: true },
  { id: 'warmFill', name: 'Warm fill', kind: 'point', color: 0xff2200, intensity: 9, position: [-3, 2, -2], moving: true },
  { id: 'warmTop', name: 'Warm top', kind: 'point', color: 0xff5500, intensity: 6, position: [0, 4, 3] },
]

type UseTrionnSymbolSceneOptions = {
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

type InteractiveMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & {
  _flash?: number
  _flashActive?: boolean
}

type SurfaceParticle = { mesh: InteractiveMesh; explodeDir: THREE.Vector3; spinAxis: THREE.Vector3; spinSpeed: number; delay: number; shapeIdx: number }
type EdgeLayer = { line: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>; shapeIdx: number; baseOpacity: number }

type GuidePoint = { x: number; y: number }
type SparkTubeLayer = { group: THREE.Group; segments: THREE.Mesh[]; material: THREE.MeshBasicMaterial; maxOpacity: number }
type SparkBolt = { line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; glowLines: Array<{ line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; baseOpacity: number }>; glowTubes: SparkTubeLayer[]; light: THREE.PointLight; points: Float32Array; life: number; maxLife: number; active: boolean }

const GUIDE_POINT_COUNT = 161
const GUIDE_ANCHORS = [[-0.59, 0.1, 0.21], [0.28, -0.85, 0.21], [0.54, 0.48, 0.21]] as const
const GUIDE_SETTINGS = [
  { anchorIndex: 0, startY: 0.85, endY: 0.2, phase: 1 },
  { anchorIndex: 2, startY: 1.13, endY: 0.1, phase: 3 },
  { anchorIndex: 1, startY: 0.93, endY: -0.065, phase: 2 },
] as const
const EMPTY_VIBRATE_ELEMENT_IDS: string[] = []

/** Owns the background symbol scene, its input handlers, render loop and cleanup. */
export function useTrionnSymbolScene({ controls, runtime, showGuides = true, showSymbol = true, enableBlast = true, enableAudio = true, soundEnabled = true, toneMappingExposure = 1.1, lightingControls, vibrateElementIds = EMPTY_VIBRATE_ELEMENT_IDS }: UseTrionnSymbolSceneOptions) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef(controls)
  const lightingControlsRef = useRef(lightingControls)
  const soundEnabledRef = useRef(soundEnabled)
  controlsRef.current = controls
  lightingControlsRef.current = lightingControls
  soundEnabledRef.current = soundEnabled

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let animationFrame = 0
    let idleId: number | undefined
    let timeoutId: number | undefined
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    // WebGL setup is non-critical work and can wait until the first paint settles.
    const initialize = () => {
      if (cancelled) return

      const scene = new THREE.Scene()
      const sceneBackground = new THREE.Color(0x0c0c0c)
      scene.background = sceneBackground
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
      camera.position.set(0, 0, 7.6)
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      // The physical material is fill-rate heavy; 1.5 is the target site's
      // desktop cap and avoids a 4x pixel-cost jump on Retina displays.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = toneMappingExposure
      renderer.setClearColor(0x0c0c0c, 1)
      host.appendChild(renderer.domElement)
      const guideCanvas = document.createElement('canvas')
      guideCanvas.setAttribute('aria-hidden', 'true')
      const guideContext = guideCanvas.getContext('2d')
      // Keep the lightweight guide overlay in a native 2D canvas; only the symbol
      // and sparks need the WebGL renderer below it.
      guideCanvas.style.position = 'absolute'
      guideCanvas.style.inset = '0'
      guideCanvas.style.width = '100%'
      guideCanvas.style.height = '100%'
      guideCanvas.style.pointerEvents = 'none'
      guideCanvas.style.zIndex = '1'
      if (showGuides) host.appendChild(guideCanvas)

      const group = new THREE.Group()
      group.position.set(0, -0.1, -0.21)
      scene.add(group)
      const environment = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
      })
      const cubeCamera = new THREE.CubeCamera(0.1, 100, environment)
      scene.add(cubeCamera)
      const materialTemplate = new THREE.MeshPhysicalMaterial({
        color: 0x3a3d42,
        emissive: 0x1a2030,
        emissiveIntensity: 0.15,
        metalness: 1,
        roughness: 0.08,
        transmission: 0.35,
        ior: 2.4,
        transparent: true,
        opacity: 0.88,
        reflectivity: 1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMap: environment.texture,
        envMapIntensity: 3,
        side: THREE.DoubleSide,
        // Preserve real surface occlusion so the extruded mark reads as 3D.
        depthTest: true,
        depthWrite: true,
      })
      const particles: SurfaceParticle[] = []
      const edgeLayers: EdgeLayer[] = []
      let particleRandomState = 0x5f3759df
      const particleRandom = () => {
        particleRandomState = (Math.imul(1664525, particleRandomState) + 1013904223) >>> 0
        return particleRandomState / 0x100000000
      }

      createTrionnShapes().forEach((shape, shapeIdx) => {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 })
        geometry.computeBoundingBox()
        const center = new THREE.Vector3(); geometry.boundingBox?.getCenter(center)
        const positions = geometry.attributes.position.array
        const normals = geometry.attributes.normal.array
        const groups = new Map<string, { triangles: number[]; normal: THREE.Vector3 }>()
        for (let triangle = 0; triangle < positions.length / 9; triangle += 1) {
          const offset = triangle * 9
          const nx = Math.round(Number(normals[offset]) * 10) / 10
          const ny = Math.round(Number(normals[offset + 1]) * 10) / 10
          const nz = Math.round(Number(normals[offset + 2]) * 10) / 10
          const key = `${nx},${ny},${nz}`
          const entry = groups.get(key) ?? { triangles: [], normal: new THREE.Vector3(nx, ny, nz) }
          entry.triangles.push(triangle); groups.set(key, entry)
        }
        groups.forEach(({ triangles, normal }) => {
          const groupedPositions: number[] = []; const groupedNormals: number[] = []
          let centroidX = 0; let centroidY = 0; let centroidZ = 0
          triangles.forEach((triangle) => {
            const offset = triangle * 9
            for (let index = 0; index < 9; index += 1) { groupedPositions.push(Number(positions[offset + index])); groupedNormals.push(Number(normals[offset + index])) }
            centroidX += Number(positions[offset]) + Number(positions[offset + 3]) + Number(positions[offset + 6])
            centroidY += Number(positions[offset + 1]) + Number(positions[offset + 4]) + Number(positions[offset + 7])
            centroidZ += Number(positions[offset + 2]) + Number(positions[offset + 5]) + Number(positions[offset + 8])
          })
          const vertexCount = triangles.length * 3
          const centroid = new THREE.Vector3(centroidX / vertexCount, centroidY / vertexCount, centroidZ / vertexCount)
          const radial = centroid.sub(center).normalize()
          const explodeDir = radial.multiplyScalar(0.6).add(normal.clone().multiplyScalar(0.4)).normalize()
          const particleGeometry = new THREE.BufferGeometry()
          particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(groupedPositions), 3))
          particleGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(groupedNormals), 3))
          const mesh = new THREE.Mesh(particleGeometry, materialTemplate.clone()) as InteractiveMesh
          mesh._flash = 0; mesh._flashActive = false; group.add(mesh)
          particles.push({ mesh, explodeDir, spinAxis: new THREE.Vector3(particleRandom() - 0.5, particleRandom() - 0.5, particleRandom() - 0.5).normalize(), spinSpeed: (particleRandom() - 0.5) * 0.8, delay: particleRandom() * 0.25, shapeIdx })
        })
        const edgeGeometry = new THREE.EdgesGeometry(geometry, 8)
        const edgeMaterials = [0.08, 0.05].map((opacity) => new THREE.LineBasicMaterial({ color: 0x363e4d, transparent: true, opacity }))
        edgeMaterials.forEach((material, index) => {
          const line = new THREE.LineSegments(edgeGeometry, material); if (index === 1) line.scale.setScalar(1.004); group.add(line); edgeLayers.push({ line, shapeIdx, baseOpacity: material.opacity })
        })
        geometry.dispose()
      })

      const ambient = new THREE.AmbientLight(0x2a3040, 2.8)
      scene.add(ambient)
      const key = new THREE.DirectionalLight(0xffffff, 1.6)
      key.position.set(4, 5, 4); scene.add(key)
      const coolBack = new THREE.DirectionalLight(0x8899aa, 0.8)
      coolBack.position.set(-4, 1, -2); scene.add(coolBack)
      const cool = new THREE.DirectionalLight(0xccddee, 1.5)
      cool.position.set(0, -3, -5); scene.add(cool)
      const edge = new THREE.DirectionalLight(0x8899aa, 1)
      edge.position.set(-3, 2, 6); scene.add(edge)
      const front = new THREE.DirectionalLight(0x6677aa, 1.2)
      front.position.set(0, 0, -8); scene.add(front)
      const left = new THREE.DirectionalLight(0x6677aa, 1)
      left.position.set(-8, 0, 0); scene.add(left)
      const right = new THREE.DirectionalLight(0x6677aa, 1)
      right.position.set(8, 0, 0); scene.add(right)
      const bottom = new THREE.DirectionalLight(0x6677aa, 1)
      bottom.position.set(0, -8, 0); scene.add(bottom)
      const top = new THREE.DirectionalLight(0xaabbcc, 1)
      top.position.set(0, 8, 2); scene.add(top)
      const fill = new THREE.PointLight(0xff3300, 12, 22)
      fill.position.set(3, -1, 3); scene.add(fill)
      const warmFill = new THREE.PointLight(0xff2200, 9, 20)
      warmFill.position.set(-3, 2, -2); scene.add(warmFill)
      const warmTop = new THREE.PointLight(0xff5500, 6, 14)
      warmTop.position.set(0, 4, 3); scene.add(warmTop)
      const editableLights: Record<TrionnLightId, THREE.Light> = {
        ambient,
        key,
        coolBack,
        cool,
        edge,
        front,
        left,
        right,
        bottom,
        top,
        fill,
        warmFill,
        warmTop,
      }
      const reflectionPointsGeometry = new THREE.BufferGeometry()
      const reflectionPointPositions = new Float32Array(600)
      for (let index = 0; index < reflectionPointPositions.length; index += 1) reflectionPointPositions[index] = (Math.random() - 0.5) * 20
      reflectionPointsGeometry.setAttribute('position', new THREE.BufferAttribute(reflectionPointPositions, 3))
      const reflectionPoints = new THREE.Points(reflectionPointsGeometry, new THREE.PointsMaterial({ color: 0xff3300, size: 0.022, transparent: true, opacity: 0.35 }))
      reflectionPoints.visible = window.innerWidth >= 768; scene.add(reflectionPoints)
      const boltColors = [0xffffff, 0x88ddff, 0x44aaff, 0x0066ff, 0x00ccff, 0xaaddff, 0x44cc]
      const glowTubeLayers = [
        { color: 0x0d33, radius: 0.1375, maxOpacity: 0.025 },
        { color: 0x1a66, radius: 0.09, maxOpacity: 0.05 },
        { color: 0x33aa, radius: 0.055, maxOpacity: 0.08 },
        { color: 0x55ee, radius: 0.03, maxOpacity: 0.13 },
        { color: 0x44aaff, radius: 0.01375, maxOpacity: 0.24 },
        { color: 0xbbddff, radius: 0.005, maxOpacity: 0.35 },
      ]
      const up = new THREE.Vector3(0, 1, 0)
      const bolts: SparkBolt[] = Array.from({ length: 5 }, () => {
        const points = new Float32Array(30)
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3)); geometry.setDrawRange(0, 10)
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0, depthTest: false, depthWrite: false }))
        line.renderOrder = 999; line.visible = false; scene.add(line)
        const glowLines = [0.12, 0.2, 0.35].map((baseOpacity) => {
          const glowPoints = new Float32Array(30); const glowGeometry = new THREE.BufferGeometry()
          glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPoints, 3)); glowGeometry.setDrawRange(0, 10)
          const glow = new THREE.Line(glowGeometry, new THREE.LineBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }))
          glow.renderOrder = 998; glow.visible = false; scene.add(glow); return { line: glow, baseOpacity }
        })
        const glowTubes = glowTubeLayers.map((layer) => {
          const material = new THREE.MeshBasicMaterial({ color: layer.color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending })
          const geometry = new THREE.CylinderGeometry(layer.radius, layer.radius, 1, 16, 1, true)
          const tubeGroup = new THREE.Group(); tubeGroup.renderOrder = 996; tubeGroup.visible = false
          const segments = Array.from({ length: 9 }, () => { const segment = new THREE.Mesh(geometry, material); segment.renderOrder = 996; segment.visible = false; tubeGroup.add(segment); return segment })
          scene.add(tubeGroup)
          return { group: tubeGroup, segments, material, maxOpacity: layer.maxOpacity }
        })
        const light = new THREE.PointLight(0xaaccff, 0, 14); light.visible = false; scene.add(light)
        return { line, glowLines, glowTubes, light, points, life: 0, maxLife: 0, active: false }
      })

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2(-9999, -9999)
      const panelMeshes = particles.map(({ mesh }) => mesh)
      let hoveredMesh: InteractiveMesh | null = null
      let audioContext: AudioContext | null = null
      let hoverBuffer: AudioBuffer | null = null
      let hoverBufferPromise: Promise<void> | null = null
      let sparkBuffer: AudioBuffer | null = null
      let sparkBufferPromise: Promise<void> | null = null
      let sparkSource: AudioBufferSourceNode | null = null
      let sparkGain: GainNode | null = null
      let wooshBuffer: AudioBuffer | null = null
      let wooshBufferPromise: Promise<void> | null = null
      let wooshSource: AudioBufferSourceNode | null = null
      let wooshGain: GainNode | null = null
      let wooshStartPending = false
      let explodeBuffer: AudioBuffer | null = null
      let explodeBufferPromise: Promise<void> | null = null
      let explodeSource: AudioBufferSourceNode | null = null
      let explodeGain: GainNode | null = null
      let joinBuffer: AudioBuffer | null = null
      let joinBufferPromise: Promise<void> | null = null
      let vibrateNode: ScriptProcessorNode | null = null
      let vibrateGain: GainNode | null = null
      let pointerX = 0; let pointerY = 0; let holding = false; let holdTime = 0; let vibrateAmt = 0; let vibratePhase = 0; let explode = 0; let hoverAmt = 0; let joinPlayed = false
      // Match the live Hero's initial orientation before its idle drift begins.
      let rotX = 0.3
      let rotY = 0.4
      group.rotation.set(rotX, rotY, 0)
      let pointerScreenX = -9999
      let pointerScreenY = -9999
      let guideTime = 0
      const guideProgress = [0, 0, 0]
      const guideLines: GuidePoint[][] = GUIDE_SETTINGS.map(() => Array.from({ length: GUIDE_POINT_COUNT }, () => ({ x: 0, y: 0 })))
      const guideAnchors: GuidePoint[] = GUIDE_ANCHORS.map(() => ({ x: 0, y: 0 }))
      const guideProjection = new THREE.Vector3()
      const guideHitPoint: GuidePoint = { x: 0, y: 0 }
      const drifts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
      let weldCooldown = 0
      let sparkHoverActive = false
      let sparkWasAway = true
      let sparkBurstLeft = 0
      let sparkSoundPlayed = false
      let scrollProgress = 0
      let introAmt = 1
      let environmentReady = false
      let environmentFrame = 0
      let appliedBackgroundColor = 0x0c0c0c
      let appliedMetalness = Number.NaN
      let appliedRoughness = Number.NaN
      let appliedTransmission = Number.NaN
      let appliedClearcoat = Number.NaN
      const vibrationTargets = vibrateElementIds.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element))
      let vibrationReset = true
      const getLayout = (width: number) => width > 1440
        ? { fov: 42, z: 6, scale: 1, x: 0, y: 0 }
        : width >= 1024
          ? { fov: 40, z: 6.28, scale: 0.9, x: 0, y: -0.02 }
          : width >= 768
            ? { fov: 38, z: 7.55, scale: 0.84, x: 0, y: -0.035 }
            : { fov: 36, z: 9.35, scale: 0.74, x: 0, y: -0.055 }
      let lastFrameTime = performance.now()

      const prepareAudio = () => {
        if (!enableAudio) return null
        if (audioContext) return audioContext
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return null
        audioContext = new AudioContextClass()
        return audioContext
      }
      const preloadHoverAudio = () => {
        if (!soundEnabledRef.current) return
        if (hoverBuffer || hoverBufferPromise) return
        const audio = prepareAudio()
        if (!audio) return
        hoverBufferPromise = fetch('/assets/hover-beep.mp3')
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data))
          .then((buffer) => { hoverBuffer = buffer })
          .catch(() => { hoverBufferPromise = null })
      }
      const preloadSparkAudio = () => {
        if (!soundEnabledRef.current) return
        if (sparkBuffer || sparkBufferPromise) return
        const audio = prepareAudio()
        if (!audio) return
        sparkBufferPromise = fetch('/assets/hero-spark.mp3')
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data))
          .then((buffer) => { sparkBuffer = buffer; sparkBufferPromise = null })
          .catch(() => { sparkBufferPromise = null })
      }
      const preloadWooshAudio = () => {
        if (!soundEnabledRef.current || wooshBuffer || wooshBufferPromise) return
        const audio = prepareAudio()
        if (!audio) return
        wooshBufferPromise = fetch('/assets/woosh-loop.mp3')
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data))
          .then((buffer) => { wooshBuffer = buffer; wooshBufferPromise = null })
          .catch(() => { wooshBufferPromise = null })
      }
      const preloadBlastAudio = () => {
        if (!soundEnabledRef.current) return
        const audio = prepareAudio()
        if (!audio) return
        if (!explodeBuffer && !explodeBufferPromise) {
          explodeBufferPromise = fetch('/assets/glass-shatter.mp3')
            .then((response) => response.arrayBuffer())
            .then((data) => audio.decodeAudioData(data))
            .then((buffer) => { explodeBuffer = buffer; explodeBufferPromise = null })
            .catch(() => { explodeBufferPromise = null })
        }
        if (!joinBuffer && !joinBufferPromise) {
          joinBufferPromise = fetch('/assets/join-zoom.mp3')
            .then((response) => response.arrayBuffer())
            .then((data) => audio.decodeAudioData(data))
            .then((buffer) => { joinBuffer = buffer; joinBufferPromise = null })
            .catch(() => { joinBufferPromise = null })
        }
      }
      const startVibrateSound = () => {
        if (!soundEnabledRef.current || vibrateNode) return
        const audio = prepareAudio()
        if (!audio) return
        const node = audio.createScriptProcessor(4096, 1, 1)
        let previous = 0
        node.onaudioprocess = (event) => {
          const output = event.outputBuffer.getChannelData(0)
          for (let index = 0; index < output.length; index += 1) {
            previous = (previous + 0.02 * (Math.random() * 2 - 1)) / 1.02
            output[index] = previous * 3.5
          }
        }
        const filter = audio.createBiquadFilter()
        filter.type = 'lowpass'; filter.frequency.value = 80
        const gain = audio.createGain()
        gain.gain.setValueAtTime(0, audio.currentTime)
        gain.gain.linearRampToValueAtTime(0.18, audio.currentTime + 0.1)
        node.connect(filter); filter.connect(gain); gain.connect(audio.destination)
        vibrateNode = node; vibrateGain = gain
      }
      const stopVibrateSound = () => {
        const audio = audioContext; const node = vibrateNode; const gain = vibrateGain
        vibrateNode = null; vibrateGain = null
        if (!audio || !node || !gain) return
        gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.15)
        window.setTimeout(() => node.disconnect(), 200)
      }
      const playExplodeSound = () => {
        if (!soundEnabledRef.current || !explodeBuffer) return
        const audio = prepareAudio()
        if (!audio) return
        try { explodeSource?.stop() } catch { /* already stopped */ }
        const source = audio.createBufferSource(); const gain = audio.createGain()
        source.buffer = explodeBuffer; gain.gain.setValueAtTime(0.9, audio.currentTime)
        source.connect(gain).connect(audio.destination); source.start()
        explodeSource = source; explodeGain = gain
        source.onended = () => { if (explodeSource === source) { explodeSource = null; explodeGain = null } }
      }
      const stopExplodeSound = () => {
        const audio = audioContext; const source = explodeSource; const gain = explodeGain
        explodeSource = null; explodeGain = null
        if (!audio || !source || !gain) return
        gain.gain.linearRampToValueAtTime(0, audio.currentTime + 0.1)
        window.setTimeout(() => { try { source.stop() } catch { /* already stopped */ } }, 150)
      }
      const playJoinSound = () => {
        if (!soundEnabledRef.current || !joinBuffer) return
        const audio = prepareAudio()
        if (!audio) return
        const source = audio.createBufferSource(); const gain = audio.createGain()
        source.buffer = joinBuffer; gain.gain.setValueAtTime(0.7, audio.currentTime)
        source.connect(gain).connect(audio.destination); source.start()
      }
      const startWooshSound = () => {
        if (!soundEnabledRef.current || wooshSource || wooshStartPending) return
        const audio = prepareAudio()
        if (!audio) return
        wooshStartPending = true
        const play = () => {
          wooshStartPending = false
          if (!soundEnabledRef.current || !wooshBuffer || wooshSource) return
          const source = audio.createBufferSource()
          const gain = audio.createGain()
          source.buffer = wooshBuffer
          source.loop = true
          gain.gain.setValueAtTime(0, audio.currentTime)
          gain.gain.linearRampToValueAtTime(0.07, audio.currentTime + 2)
          source.connect(gain).connect(audio.destination)
          source.start()
          wooshSource = source
          wooshGain = gain
        }
        if (wooshBuffer) {
          if (audio.state === 'suspended') void audio.resume().then(play)
          else play()
          return
        }
        preloadWooshAudio()
        void wooshBufferPromise?.then(() => {
          if (audio.state === 'suspended') void audio.resume().then(play)
          else play()
        })
      }
      const stopWooshSound = () => {
        wooshStartPending = false
        if (!audioContext || !wooshSource || !wooshGain) return
        const now = audioContext.currentTime
        const source = wooshSource
        wooshGain.gain.cancelScheduledValues(now)
        wooshGain.gain.setValueAtTime(wooshGain.gain.value, now)
        wooshGain.gain.linearRampToValueAtTime(0, now + 1.5)
        wooshSource = null
        wooshGain = null
        window.setTimeout(() => { try { source.stop() } catch { /* already stopped */ } }, 1600)
      }
      const playHoverBeep = () => {
        if (!soundEnabledRef.current) return
        const audio = prepareAudio()
        if (!audio) return
        const play = () => {
          if (hoverBuffer) {
            const source = audio.createBufferSource()
            const gain = audio.createGain()
            source.buffer = hoverBuffer
            gain.gain.value = 0.7
            source.connect(gain).connect(audio.destination)
            source.start()
            return
          }
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(740, audio.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(920, audio.currentTime + 0.07)
          gain.gain.setValueAtTime(0.0001, audio.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.035, audio.currentTime + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09)
          oscillator.connect(gain).connect(audio.destination)
          oscillator.start()
          oscillator.stop(audio.currentTime + 0.1)
        }
        if (audio.state === 'suspended') void audio.resume().then(play)
        else play()
      }
      const resetVibrationTargets = () => {
        vibrationTargets.forEach((element) => {
          element.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          element.style.transform = 'perspective(600px) translate(0px, 0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)'
        })
        vibrationReset = true
      }
      const updateVibrationTargets = (elapsed: number) => {
        if (holding && holdTime < 0.7 && vibrateAmt > 0.01) {
          const x = Math.sin(vibratePhase) * vibrateAmt * 2.5
          const y = Math.cos(vibratePhase * 1.3) * vibrateAmt * 1.5
          vibrationTargets.forEach((element) => {
            element.style.transition = 'none'
            element.style.transform = `translate(${x}px, ${y}px)`
          })
          vibrationReset = false
          return
        }
        if (explode > 0.01 && holdTime >= 0.7) {
          vibrationTargets.forEach((element, index) => {
            const phase = index * Math.PI * 2 / Math.max(1, vibrationTargets.length)
            const x = Math.sin(elapsed * 0.8 + phase) * explode * 30
            const y = Math.cos(elapsed * 0.48 + phase) * explode * 20
            const rotateX = Math.sin(elapsed * 0.8 + phase) * explode * 25
            const rotateY = Math.cos(elapsed * 0.56 + phase) * explode * 20
            const rotateZ = Math.sin(elapsed * 0.4 + phase * 1.3) * explode * 15
            element.style.transition = 'none'
            element.style.transform = `perspective(600px) translate(${x}px, ${y}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`
          })
          vibrationReset = false
          return
        }
        if (!holding && explode <= 0.01 && !vibrationReset) resetVibrationTargets()
      }
      const onPointerMove = (event: PointerEvent) => {
        if (holding && event.buttons === 0) holding = false
        const bounds = host.getBoundingClientRect()
        pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1
        pointerY = -((event.clientY - bounds.top) / bounds.height * 2 - 1)
        mouse.set(pointerX, pointerY)
        pointerScreenX = event.clientX - bounds.left
        pointerScreenY = event.clientY - bounds.top
        preloadHoverAudio()
      }
      const onPointerLeave = () => { mouse.set(-9999, -9999); pointerScreenX = -9999; pointerScreenY = -9999; hoveredMesh = null; stopSparkSound(); sparkWasAway = true; sparkHoverActive = false; sparkSoundPlayed = false; sparkBurstLeft = 0 }
      const unlockAudio = () => {
        if (!soundEnabledRef.current) return
        const audio = prepareAudio()
        if (audio?.state === 'suspended') void audio.resume()
        preloadHoverAudio()
      }
      const onSoundChange = (event: Event) => {
        const enabled = (event as CustomEvent<{ enabled: boolean }>).detail.enabled
        soundEnabledRef.current = enabled
        if (enabled) {
          unlockAudio()
          preloadSparkAudio()
          preloadWooshAudio()
          preloadBlastAudio()
          startWooshSound()
          if (holding && holdTime < 0.5) startVibrateSound()
        } else {
          stopSparkSound()
          stopWooshSound()
          stopVibrateSound()
          stopExplodeSound()
        }
      }
      const onPointerDown = (event: PointerEvent) => {
        unlockAudio()
        if (!enableBlast || event.button !== 0 || !runtime.current.transitionReady) return
        const bounds = host.getBoundingClientRect()
        pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1
        pointerY = -((event.clientY - bounds.top) / bounds.height * 2 - 1)
        mouse.set(pointerX, pointerY)
        camera.updateMatrixWorld(); group.updateMatrixWorld(true); raycaster.setFromCamera(mouse, camera)
        if (!raycaster.intersectObjects(panelMeshes, false).length) return
        holding = true; holdTime = 0; vibrateAmt = 1; vibratePhase = 0; explode = 0; joinPlayed = false; vibrationReset = false
        startVibrateSound()
        try { host.setPointerCapture(event.pointerId) } catch { /* unsupported pointer capture */ }
      }
      const onKeyDown = () => { unlockAudio() }
      const onPointerUp = (event?: PointerEvent) => {
        const wasHolding = holding
        holding = false; vibrateAmt = 0
        if (wasHolding) {
          resetVibrationTargets(); stopVibrateSound(); stopExplodeSound()
          if (explode >= 0.98 && !joinPlayed) { joinPlayed = true; playJoinSound() }
        }
        if (event && host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture(event.pointerId)
      }
      const onInteractionCancel = () => {
        holding = false; vibrateAmt = 0; hoveredMesh = null; stopSparkSound(); stopVibrateSound(); stopExplodeSound(); resetVibrationTargets()
        sparkHoverActive = false; sparkWasAway = true; sparkSoundPlayed = false; sparkBurstLeft = 0
      }
      const resize = () => {
        const width = host.clientWidth; const height = host.clientHeight
        const layout = getLayout(width)
        camera.aspect = width / height; camera.fov = layout.fov; camera.position.z = layout.z; camera.updateProjectionMatrix(); renderer.setSize(width, height, false)
        group.position.set(layout.x, layout.y, -0.21); group.scale.setScalar(layout.scale)
        const pixelRatio = Math.min(window.devicePixelRatio, 1)
        guideCanvas.width = Math.max(1, Math.floor(width * pixelRatio))
        guideCanvas.height = Math.max(1, Math.floor(height * pixelRatio))
        guideContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      }
      const updateGuideLines = (width: number, height: number) => {
        for (let index = 0; index < GUIDE_ANCHORS.length; index += 1) {
          const source = GUIDE_ANCHORS[index]
          const target = guideAnchors[index]
          guideProjection.set(source[0], source[1], source[2]).applyMatrix4(group.matrixWorld).project(camera)
          target.x = (guideProjection.x + 1) * 0.5 * width
          target.y = (-guideProjection.y + 1) * 0.5 * height
        }
        for (let lineIndex = 0; lineIndex < GUIDE_SETTINGS.length; lineIndex += 1) {
          const { anchorIndex, startY: startYFactor, endY: endYFactor, phase } = GUIDE_SETTINGS[lineIndex]
          const anchor = guideAnchors[anchorIndex]
          const startY = height * startYFactor
          const endY = height * endYFactor
          const controlX = 2 * anchor.x - 0.5 * width
          const controlY = 2 * anchor.y - 0.5 * startY - 0.5 * endY
          const directLength = Math.hypot(width, endY - startY) || 1
          const points = guideLines[lineIndex]
          for (let index = 0; index < GUIDE_POINT_COUNT; index += 1) {
            const progress = index / (GUIDE_POINT_COUNT - 1); const inverse = 1 - progress
            const baseX = 2 * inverse * progress * controlX + progress * progress * width
            const baseY = inverse * inverse * startY + 2 * inverse * progress * controlY + progress * progress * endY
            const tangentX = 2 * inverse * controlX + 2 * progress * (width - controlX)
            const tangentY = 2 * inverse * (controlY - startY) + 2 * progress * (endY - controlY)
            const tangentLength = Math.hypot(tangentX, tangentY) || 1
            const wave = (0.75 * Math.sin(guideTime * 0.38 + phase * 2.1 + progress * Math.PI * 1.1) + 0.25 * Math.sin(guideTime * 0.19 + phase * 0.9 + progress * Math.PI * 1.9)) * Math.sin(progress * Math.PI) * (0.01 * directLength)
            const point = points[index]
            point.x = baseX - tangentY / tangentLength * wave
            point.y = baseY + tangentX / tangentLength * wave
          }
        }
      }
      const mouseNearLine = (points: GuidePoint[], tolerance: number, result: GuidePoint) => {
        let found = false; let bestDistance = tolerance * tolerance
        for (let index = 0; index < points.length - 1; index += 1) {
          const a = points[index]; const b = points[index + 1]
          const dx = b.x - a.x; const dy = b.y - a.y; const lengthSq = dx * dx + dy * dy || 1
          const t = Math.max(0, Math.min(1, ((pointerScreenX - a.x) * dx + (pointerScreenY - a.y) * dy) / lengthSq))
          const candidateX = a.x + t * dx; const candidateY = a.y + t * dy
          const distance = (candidateX - pointerScreenX) ** 2 + (candidateY - pointerScreenY) ** 2
          if (distance < bestDistance) { bestDistance = distance; result.x = candidateX; result.y = candidateY; found = true }
        }
        return found
      }
      const triggerWeld = (start: GuidePoint, targets: GuidePoint[]) => {
        targets.forEach((target) => {
          const bolt = bolts.find((candidate) => !candidate.active)
          if (!bolt) return
          const width = host.clientWidth; const height = host.clientHeight
          const toWorld = (point: GuidePoint) => {
            const projected = new THREE.Vector3(point.x / width * 2 - 1, -(point.y / height * 2) + 1, 0.5).unproject(camera)
            const direction = projected.sub(camera.position).normalize()
            return camera.position.clone().add(direction.multiplyScalar(-camera.position.z / direction.z))
          }
          const from = toWorld(start); const to = toWorld(target); const delta = to.clone().sub(from); const length = delta.length() || 0.001
          const side = new THREE.Vector3(-delta.y / length, delta.x / length, 0)
          for (let index = 0; index < 10; index += 1) {
            const progress = index / 9; const point = from.clone().lerp(to, progress)
            const jitter = index === 0 || index === 9 ? 0 : (Math.random() - 0.5) * Math.min(length * 0.4, 0.12) * Math.sin(progress * Math.PI)
            point.addScaledVector(side, jitter); point.z += index === 0 || index === 9 ? 0 : (Math.random() - 0.5) * 0.02
            bolt.points[index * 3] = point.x; bolt.points[index * 3 + 1] = point.y; bolt.points[index * 3 + 2] = point.z
          }
          const color = boltColors[Math.floor(Math.random() * boltColors.length)]
          bolt.line.visible = true; bolt.line.material.color.setHex(color); bolt.line.material.opacity = 0.95
          const position = bolt.line.geometry.getAttribute('position') as THREE.BufferAttribute; position.needsUpdate = true
          bolt.glowLines.forEach(({ line: glow, baseOpacity }) => { glow.visible = true; const glowPosition = glow.geometry.getAttribute('position') as THREE.BufferAttribute; (glowPosition.array as Float32Array).set(bolt.points); glowPosition.needsUpdate = true; glow.material.color.setHex(color); glow.material.opacity = baseOpacity })
          bolt.glowTubes.forEach((tube) => {
            tube.group.visible = true; tube.material.opacity = 0
            for (let index = 0; index < 9; index += 1) {
              const a = new THREE.Vector3(bolt.points[index * 3], bolt.points[index * 3 + 1], bolt.points[index * 3 + 2])
              const b = new THREE.Vector3(bolt.points[(index + 1) * 3], bolt.points[(index + 1) * 3 + 1], bolt.points[(index + 1) * 3 + 2])
              const segment = tube.segments[index]; const length = a.distanceTo(b)
              if (length < 1e-4) { segment.visible = false; continue }
              segment.visible = true; segment.position.copy(a).lerp(b, 0.5); segment.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); segment.scale.set(1, length, 1)
            }
          })
          bolt.light.visible = true; bolt.light.position.copy(from).lerp(to, 0.5); bolt.light.intensity = 12
          bolt.maxLife = 0.05 + Math.random() * 0.09; bolt.life = bolt.maxLife; bolt.active = true
        })
        if (!sparkSoundPlayed && playSparkSound()) sparkSoundPlayed = true
      }
      const playSparkSound = () => {
        if (!soundEnabledRef.current) return false
        const audio = prepareAudio()
        if (!audio || !sparkBuffer) return false
        const play = () => {
          sparkSource?.stop(); sparkSource = audio.createBufferSource(); sparkGain = audio.createGain(); sparkSource.buffer = sparkBuffer; sparkGain.gain.setValueAtTime(0.16, audio.currentTime); sparkSource.connect(sparkGain).connect(audio.destination); sparkSource.start(0); sparkSource.onended = () => { sparkSource = null; sparkGain = null }
        }
        if (audio.state === 'suspended') void audio.resume().then(play); else play()
        return true
      }
      const stopSparkSound = () => {
        if (!audioContext || !sparkGain || !sparkSource) return
        const now = audioContext.currentTime
        sparkGain.gain.cancelScheduledValues(now); sparkGain.gain.setValueAtTime(sparkGain.gain.value, now); sparkGain.gain.linearRampToValueAtTime(0.0001, now + 0.05)
        const source = sparkSource; sparkSource = null; sparkGain = null; window.setTimeout(() => { try { source.stop() } catch { /* already ended */ } }, 70)
      }
      const drawGuidesAndSparks = (delta: number) => {
        if (!guideContext || !showGuides) return
        const width = host.clientWidth; const height = host.clientHeight
        guideTime += delta; updateGuideLines(width, height)
        for (let index = 0; index < guideProgress.length; index += 1) guideProgress[index] = Math.min(1, guideProgress[index] + delta * (0.8 + index * 0.12))
        guideContext.clearRect(0, 0, width, height)
        guideContext.lineCap = 'round'; guideContext.lineJoin = 'round'
        let linesReady = true
        for (let lineIndex = 0; lineIndex < guideLines.length; lineIndex += 1) {
          const points = guideLines[lineIndex]
          const midpoint = Math.floor(points.length / 2)
          const span = Math.max(1, Math.round(midpoint * guideProgress[lineIndex]))
          const firstIndex = Math.max(0, midpoint - span)
          const lastIndex = Math.min(points.length - 1, midpoint + span)
          guideContext.beginPath(); guideContext.moveTo(points[firstIndex].x, points[firstIndex].y)
          let nearDistance = Infinity
          for (let index = firstIndex; index <= lastIndex; index += 1) {
            const point = points[index]
            if (index > firstIndex) guideContext.lineTo(point.x, point.y)
            nearDistance = Math.min(nearDistance, Math.hypot(point.x - pointerScreenX, point.y - pointerScreenY))
          }
          const mouseFade = pointerScreenX === -9999 ? 1 : 1 - 0.65 * Math.max(0, Math.min(1, nearDistance / 14))
          guideContext.strokeStyle = 'rgba(58, 70, 88, 1)'; guideContext.globalAlpha = 0.95 * mouseFade; guideContext.lineWidth = 0.85; guideContext.stroke(); guideContext.globalAlpha = 1
          if (guideProgress[lineIndex] < 0.995) linesReady = false
        }
        if (linesReady && pointerScreenX !== -9999 && explode < 0.08 && !holding && runtime.current.transitionReady) {
          let hit: GuidePoint | null = null; let hitIndex = -1
          for (let index = 0; index < guideLines.length; index += 1) { if (mouseNearLine(guideLines[index], 14, guideHitPoint)) { hit = guideHitPoint; hitIndex = index; break } }
          if (hit) {
            if (!sparkHoverActive && sparkWasAway) { sparkHoverActive = true; sparkWasAway = false; sparkSoundPlayed = false; sparkBurstLeft = 5 + Math.floor(Math.random() * 2) }
            if (weldCooldown <= 0 && sparkBurstLeft > 0 && bolts.some((bolt) => !bolt.active)) {
              const targets = guideLines.map((_, index) => index).filter((index) => index !== hitIndex).sort(() => Math.random() - 0.5).slice(0, Math.random() > 0.5 ? 1 : 2).map((index) => guideLines[index].reduce((best, point) => ((point.x - hit!.x) ** 2 + (point.y - hit!.y) ** 2 < (best.x - hit!.x) ** 2 + (best.y - hit!.y) ** 2 ? point : best), guideLines[index][0]))
              triggerWeld(hit, targets); sparkBurstLeft -= 1; if (sparkBurstLeft <= 0) stopSparkSound(); weldCooldown = 0.04 + Math.random() * 0.06
            }
          } else { stopSparkSound(); sparkHoverActive = false; sparkWasAway = true; sparkSoundPlayed = false; sparkBurstLeft = 0 }
        }
        weldCooldown = Math.max(0, weldCooldown - delta)
        bolts.forEach((bolt) => { if (!bolt.active) { bolt.line.visible = false; bolt.line.material.opacity = 0; bolt.glowLines.forEach(({ line }) => { line.visible = false; line.material.opacity = 0 }); bolt.glowTubes.forEach((tube) => { tube.group.visible = false; tube.material.opacity = 0 }); bolt.light.visible = false; bolt.light.intensity = 0; return }; bolt.life -= delta; const alpha = Math.max(0, bolt.life / bolt.maxLife); const flicker = 0.7 + 0.3 * Math.random(); bolt.line.visible = true; bolt.line.material.opacity = alpha * flicker; bolt.glowLines.forEach(({ line, baseOpacity }) => { line.visible = true; line.material.opacity = baseOpacity * alpha * flicker }); bolt.glowTubes.forEach((tube) => { tube.group.visible = true; tube.material.opacity = tube.maxOpacity * alpha * flicker }); const travelIndex = 3 * Math.min(8, Math.floor((1 - alpha) * 9)); bolt.light.visible = true; bolt.light.position.set(bolt.points[travelIndex], bolt.points[travelIndex + 1], bolt.points[travelIndex + 2]); bolt.light.intensity = (12 + 8 * Math.random()) * alpha; if (bolt.life <= 0) { bolt.active = false; bolt.line.visible = false; bolt.line.material.opacity = 0; bolt.glowLines.forEach(({ line }) => { line.visible = false; line.material.opacity = 0 }); bolt.glowTubes.forEach((tube) => { tube.group.visible = false; tube.material.opacity = 0 }); bolt.light.visible = false; bolt.light.intensity = 0 } })
      }
      const animate = () => {
        const current = controlsRef.current; const shared = runtime.current; const now = performance.now()
        const delta = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000))
        lastFrameTime = now
        const elapsed = now / 1000
        const normalizedScroll = window.scrollY / Math.max(1, window.innerHeight)
        const targetScrollProgress = normalizedScroll <= 0.1 ? 0 : normalizedScroll <= 1 ? Math.max(0, (normalizedScroll - 0.1) / 0.9) : normalizedScroll <= 1.2 ? 1 : normalizedScroll <= 1.8 ? Math.max(0, (1.8 - normalizedScroll) / 0.6) : 0
        scrollProgress += (targetScrollProgress - scrollProgress) * 0.06
        if (shared.transitionReady) introAmt = introAmt > 0.001 ? introAmt * 0.975 : 0
        const layout = getLayout(host.clientWidth)
        camera.fov = layout.fov; camera.position.z = layout.z; camera.updateProjectionMatrix()
        if (appliedMetalness !== current.metalness || appliedRoughness !== current.roughness || appliedTransmission !== current.transmission || appliedClearcoat !== current.clearcoat) {
          particles.forEach(({ mesh }) => {
            mesh.material.metalness = current.metalness
            mesh.material.roughness = current.roughness
            mesh.material.transmission = current.transmission
            mesh.material.clearcoat = current.clearcoat
          })
          appliedMetalness = current.metalness
          appliedRoughness = current.roughness
          appliedTransmission = current.transmission
          appliedClearcoat = current.clearcoat
        }
        const lighting = lightingControlsRef.current
        if (lighting) {
          renderer.toneMappingExposure = lighting.exposure
          if (appliedBackgroundColor !== lighting.backgroundColor) {
            sceneBackground.setHex(lighting.backgroundColor)
            renderer.setClearColor(lighting.backgroundColor, 1)
            appliedBackgroundColor = lighting.backgroundColor
            environmentReady = false
          }
          TRIONN_LIGHT_DEFINITIONS.forEach(({ id }) => {
            const light = editableLights[id]
            const lightControl = lighting.lights[id]
            light.visible = lightControl.enabled && (lighting.soloLight === null || lighting.soloLight === id)
            light.intensity = lightControl.intensity
            light.color.setHex(lightControl.color)
            if (id !== 'ambient') light.position.set(...lightControl.position)
          })
          if (lighting.animateMovingLights) {
            fill.position.set(4 * Math.sin(elapsed * 0.6), 2 * Math.cos(elapsed * 0.4), 3 * Math.cos(elapsed * 0.5) + 2)
            warmFill.position.set(4 * Math.cos(elapsed * 0.5), 2 * Math.sin(elapsed * 0.7), 3 * Math.sin(elapsed * 0.3) - 1)
          }
        } else {
          renderer.toneMappingExposure = toneMappingExposure
          if (appliedBackgroundColor !== 0x0c0c0c) {
            sceneBackground.setHex(0x0c0c0c)
            renderer.setClearColor(0x0c0c0c, 1)
            appliedBackgroundColor = 0x0c0c0c
            environmentReady = false
          }
          key.intensity = current.lightIntensity
          const keyAngle = THREE.MathUtils.degToRad(current.keyLightAngle)
          key.position.set(Math.cos(keyAngle) * Math.sqrt(32), 5, Math.sin(keyAngle) * Math.sqrt(32))
          // These two moving warm sources are part of the live site's reflection
          // rig; their motion is what creates the broad highlights across the arms.
          fill.position.set(4 * Math.sin(elapsed * 0.6), 2 * Math.cos(elapsed * 0.4), 3 * Math.cos(elapsed * 0.5) + 2)
          warmFill.position.set(4 * Math.cos(elapsed * 0.5), 2 * Math.sin(elapsed * 0.7), 3 * Math.sin(elapsed * 0.3) - 1)
        }
        if (!holding && shared.transitionReady) {
          rotY += prefersReducedMotion ? 0.0015 : current.rotationSpeed
          rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX))
          group.rotation.x += (rotX + pointerY * 0.22 - group.rotation.x) * 0.06
          group.rotation.y += (rotY + pointerX * 0.22 - group.rotation.y) * 0.06
        }
        vibratePhase += delta * 66
        if (holding && shared.transitionReady) {
          holdTime += delta
          vibrateAmt = 1
          if (holdTime < 0.5) {
            explode = 0
          } else {
            if (explode === 0) {
              stopVibrateSound()
              playExplodeSound()
              startWooshSound()
            }
            vibrateAmt *= 0.88
            explode = Math.min(1, explode + delta * 1.2)
          }
        } else {
          vibrateAmt = Math.max(0, vibrateAmt - delta * 4.8)
          explode = Math.max(0, explode - delta * 1.5)
        }
        updateVibrationTargets(elapsed)
        if (soundEnabledRef.current) {
          if (!wooshSource) startWooshSound()
          if (audioContext && wooshGain && wooshSource) {
            const targetGain = 0.07 + 0.93 * explode
            const gain = wooshGain.gain
            gain.setValueAtTime(gain.value + (targetGain - gain.value) * 0.05, audioContext.currentTime)
          }
        }

        if (showSymbol && mouse.x !== -9999 && scrollProgress < 0.08 && explode < 0.05 && introAmt < 0.08 && !holding && shared.transitionReady) {
          camera.updateMatrixWorld()
          group.updateMatrixWorld(true)
          raycaster.setFromCamera(mouse, camera)
          const nowHit = (raycaster.intersectObjects(panelMeshes, false)[0]?.object as InteractiveMesh | undefined) ?? null
          if (nowHit !== hoveredMesh) {
            if (nowHit) {
              nowHit._flash = 1
              nowHit._flashActive = true
              playHoverBeep()
            }
            if (hoveredMesh) hoveredMesh._flashActive = false
            hoveredMesh = nowHit
          }
        } else if (hoveredMesh) {
          hoveredMesh._flashActive = false
          hoveredMesh = null
        }

        const hoverTarget = hoveredMesh ? 0.16 : 0
        const hoverEase = 1 - Math.exp(-delta * (hoverTarget > hoverAmt ? 8 : 5))
        hoverAmt += (hoverTarget - hoverAmt) * hoverEase
        if (hoverAmt < 0.001) hoverAmt = 0
        const burstContrib = scrollProgress < 0.15 ? explode : 0
        const explodeAmt = Math.max(scrollProgress, hoverAmt, burstContrib, introAmt)
        shared.explodeAmt = explodeAmt

        const driftScale = 1 - explodeAmt
        for (let shapeIdx = 0; shapeIdx < drifts.length; shapeIdx += 1) {
          const phase = shapeIdx * Math.PI * 2 / 3
          drifts[shapeIdx].set(Math.sin(elapsed * 0.4 + phase) * 0.012 * driftScale, Math.cos(elapsed * 0.35 + phase) * 0.008 * driftScale, Math.sin(elapsed * 0.3 + phase * 1.5) * 0.006 * driftScale)
        }
        particles.forEach(({ mesh, explodeDir, spinAxis, spinSpeed, delay, shapeIdx }) => {
          const amount = Math.max(0, explodeAmt - delay)
          mesh.position.copy(explodeDir).multiplyScalar(5.5 * amount).add(drifts[shapeIdx])
          const chargeJitter = 0.018 * vibrateAmt * (1 - explodeAmt)
          mesh.position.x += Math.sin(vibratePhase + 20 * delay) * chargeJitter
          mesh.position.y += Math.cos(vibratePhase * 1.3 + 2 * shapeIdx) * chargeJitter
          mesh.rotation.set(spinAxis.x * spinSpeed * amount * Math.PI, spinAxis.y * spinSpeed * amount * Math.PI, spinAxis.z * spinSpeed * amount * Math.PI)
          mesh._flash = (mesh._flash ?? 0) * 0.92
          if (mesh._flash < 0.002) { mesh._flash = 0; mesh._flashActive = false }
          const flash = mesh._flash
          mesh.material.envMapIntensity = 3 + flash * 1.6
          mesh.material.roughness = Math.max(0.02, current.roughness - flash * 0.06)
          mesh.material.clearcoatRoughness = Math.max(0.01, 0.05 - flash * 0.035)
          mesh.material.transmission = Math.min(1, current.transmission + flash * 0.32)
          mesh.material.emissiveIntensity = 0.15 + flash * 0.1
          mesh.material.opacity = 0.88 - flash * 0.16
        })
        edgeLayers.forEach(({ line, shapeIdx, baseOpacity }) => {
          line.position.copy(drifts[shapeIdx]); line.rotation.set(0, 0, 0); line.material.opacity = baseOpacity * (1 - explodeAmt)
        })
        group.visible = false
        if (!environmentReady || (environmentFrame++ % 6 === 0 && explodeAmt > 0.01)) {
          cubeCamera.update(renderer, scene); environmentReady = true
        }
        group.visible = showSymbol; renderer.render(scene, camera)
        drawGuidesAndSparks(delta)
        animationFrame = requestAnimationFrame(animate)
      }
      preloadHoverAudio(); preloadSparkAudio(); preloadWooshAudio(); preloadBlastAudio(); startWooshSound()
      host.addEventListener('pointermove', onPointerMove); host.addEventListener('pointerleave', onPointerLeave); host.addEventListener('pointerdown', onPointerDown); window.addEventListener('trionn-sound-change', onSoundChange); window.addEventListener('pointerdown', unlockAudio, { once: true }); window.addEventListener('keydown', onKeyDown, { once: true }); window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onInteractionCancel); window.addEventListener('blur', onInteractionCancel); document.addEventListener('visibilitychange', onInteractionCancel); window.addEventListener('resize', resize)
      resize(); animate()
      const cleanup = () => {
        cancelAnimationFrame(animationFrame); host.removeEventListener('pointermove', onPointerMove); host.removeEventListener('pointerleave', onPointerLeave); host.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('trionn-sound-change', onSoundChange); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onInteractionCancel); window.removeEventListener('blur', onInteractionCancel); document.removeEventListener('visibilitychange', onInteractionCancel); window.removeEventListener('resize', resize); renderer.dispose(); materialTemplate.dispose(); environment.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) object.geometry.dispose(); if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) { const objectMaterial = object.material; if (Array.isArray(objectMaterial)) objectMaterial.forEach((item) => item.dispose()); else objectMaterial.dispose() } }); if (audioContext) void audioContext.close(); renderer.domElement.remove(); guideCanvas.remove()
      }
      return cleanup
    }

    let cleanup: (() => void) | undefined
    const run = () => { cleanup = initialize() }
    if (typeof idleWindow.requestIdleCallback === 'function') idleId = idleWindow.requestIdleCallback(run, { timeout: 700 })
    else timeoutId = window.setTimeout(run, 180)
    return () => { cancelled = true; if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId); if (timeoutId !== undefined) window.clearTimeout(timeoutId); cleanup?.() }
  }, [enableAudio, enableBlast, runtime, showGuides, showSymbol, toneMappingExposure, vibrateElementIds])

  return hostRef
}
