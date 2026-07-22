import { useEffect, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { createTrionnShapes } from '../components/hero/TrionnMark'
import type { HeroRuntimeState } from '../components/hero/runtime'

export type ThreeControls = {
  cameraFov: number
  cameraZ: number
  metalness: number
  roughness: number
  lightIntensity: number
  rotationSpeed: number
}

type UseTrionnSymbolSceneOptions = {
  controls: ThreeControls
  runtime: MutableRefObject<HeroRuntimeState>
}

type InteractiveMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & {
  _flash?: number
  _flashActive?: boolean
}

type SurfaceParticle = { mesh: InteractiveMesh; explodeDir: THREE.Vector3; spinAxis: THREE.Vector3; spinSpeed: number; delay: number; shapeIdx: number }
type EdgeLayer = { line: THREE.LineSegments; shapeIdx: number }

type GuidePoint = { x: number; y: number }
type SparkTubeLayer = { group: THREE.Group; segments: THREE.Mesh[]; material: THREE.MeshBasicMaterial; maxOpacity: number }
type SparkBolt = { line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; glowLines: Array<{ line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>; baseOpacity: number }>; glowTubes: SparkTubeLayer[]; light: THREE.PointLight; points: Float32Array; life: number; maxLife: number; active: boolean }

/** Owns the background symbol scene, its input handlers, render loop and cleanup. */
export function useTrionnSymbolScene({ controls, runtime }: UseTrionnSymbolSceneOptions) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef(controls)
  controlsRef.current = controls

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
      scene.background = new THREE.Color(0x0c0c0c)
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
      camera.position.set(0, 0, 7.6)
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      // The physical material is fill-rate heavy; 1.5 is the target site's
      // desktop cap and avoids a 4x pixel-cost jump on Retina displays.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
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
      host.appendChild(guideCanvas)

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
          particles.push({ mesh, explodeDir, spinAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spinSpeed: (Math.random() - 0.5) * 0.8, delay: Math.random() * 0.25, shapeIdx })
        })
        const edgeGeometry = new THREE.EdgesGeometry(geometry, 8)
        const edgeMaterials = [0.08, 0.05].map((opacity) => new THREE.LineBasicMaterial({ color: 0x363e4d, transparent: true, opacity }))
        edgeMaterials.forEach((material, index) => {
          const line = new THREE.LineSegments(edgeGeometry, material); if (index === 1) line.scale.setScalar(1.004); group.add(line); edgeLayers.push({ line, shapeIdx })
        })
        geometry.dispose()
      })

      scene.add(new THREE.AmbientLight(0x2a3040, 2.8))
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
      let pointerX = 0; let pointerY = 0; let holding = false; let explode = 0
      // Match the live Hero's initial orientation before its idle drift begins.
      let rotX = 0.3
      let rotY = 0.4
      group.rotation.set(rotX, rotY, 0)
      let pointerScreenX = -9999
      let pointerScreenY = -9999
      let guideTime = 0
      let guideProgress = [0, 0, 0]
      let guideLines: GuidePoint[][] = [[], [], []]
      let weldCooldown = 0
      let sparkHoverActive = false
      let sparkWasAway = true
      let sparkBurstLeft = 0
      let sparkSoundPlayed = false
      let scrollProgress = 0
      let introAmt = 1
      let environmentReady = false
      let environmentFrame = 0
      let appliedMetalness = Number.NaN
      let appliedRoughness = Number.NaN
      const getLayout = (width: number) => width > 1440
        ? { fov: 42, z: 6, scale: 1, x: 0, y: 0 }
        : width >= 1024
          ? { fov: 40, z: 6.28, scale: 0.9, x: 0, y: -0.02 }
          : width >= 768
            ? { fov: 38, z: 7.55, scale: 0.84, x: 0, y: -0.035 }
            : { fov: 36, z: 9.35, scale: 0.74, x: 0, y: -0.055 }
      let lastFrameTime = performance.now()

      const prepareAudio = () => {
        if (audioContext) return audioContext
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AudioContextClass) return null
        audioContext = new AudioContextClass()
        return audioContext
      }
      const preloadHoverAudio = () => {
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
        if (sparkBuffer || sparkBufferPromise) return
        const audio = prepareAudio()
        if (!audio) return
        sparkBufferPromise = fetch('/assets/hero-spark.mp3')
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data))
          .then((buffer) => { sparkBuffer = buffer; sparkBufferPromise = null })
          .catch(() => { sparkBufferPromise = null })
      }
      const playHoverBeep = () => {
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
        const audio = prepareAudio()
        if (audio?.state === 'suspended') void audio.resume()
        preloadHoverAudio()
      }
      const onPointerDown = (event: PointerEvent) => { unlockAudio(); holding = true; try { host.setPointerCapture(event.pointerId) } catch { /* unsupported pointer capture */ } }
      const onKeyDown = () => { unlockAudio() }
      const onPointerUp = (event?: PointerEvent) => { holding = false; if (event && host.hasPointerCapture?.(event.pointerId)) host.releasePointerCapture(event.pointerId) }
      const onInteractionCancel = () => { holding = false; hoveredMesh = null; stopSparkSound(); sparkHoverActive = false; sparkWasAway = true; sparkSoundPlayed = false; sparkBurstLeft = 0 }
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
      const buildGuideLines = (width: number, height: number): GuidePoint[][] => {
        const projectAnchor = (x: number, y: number, z: number) => {
          const projected = new THREE.Vector3(x, y, z).applyMatrix4(group.matrixWorld).project(camera)
          return { x: (projected.x + 1) * 0.5 * width, y: (-projected.y + 1) * 0.5 * height }
        }
        const anchors = [projectAnchor(-0.59, 0.1, 0.21), projectAnchor(0.28, -0.85, 0.21), projectAnchor(0.54, 0.48, 0.21)]
        const definitions = [
          { anchor: anchors[0], startY: height - height * 0.15, endY: height * 0.2, phase: 1 },
          { anchor: anchors[2], startY: height + height * 0.13, endY: height * 0.1, phase: 3 },
          { anchor: anchors[1], startY: height - height * 0.07, endY: -height * 0.065, phase: 2 },
        ]
        return definitions.map(({ anchor, startY, endY, phase }) => {
          const start = { x: 0, y: startY }; const end = { x: width, y: endY }
          const control = { x: 2 * anchor.x - 0.5 * start.x - 0.5 * end.x, y: 2 * anchor.y - 0.5 * start.y - 0.5 * end.y }
          const directLength = Math.hypot(end.x - start.x, end.y - start.y) || 1
          return Array.from({ length: 161 }, (_, index) => {
            const progress = index / 160; const inverse = 1 - progress
            const baseX = inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x
            const baseY = inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y
            const tangentX = 2 * inverse * (control.x - start.x) + 2 * progress * (end.x - control.x)
            const tangentY = 2 * inverse * (control.y - start.y) + 2 * progress * (end.y - control.y)
            const tangentLength = Math.hypot(tangentX, tangentY) || 1
            const wave = (0.75 * Math.sin(guideTime * 0.38 + phase * 2.1 + progress * Math.PI * 1.1) + 0.25 * Math.sin(guideTime * 0.19 + phase * 0.9 + progress * Math.PI * 1.9)) * Math.sin(progress * Math.PI) * (0.01 * directLength)
            return { x: baseX - tangentY / tangentLength * wave, y: baseY + tangentX / tangentLength * wave }
          })
        })
      }
      const closestPointOnSegment = (point: GuidePoint, a: GuidePoint, b: GuidePoint) => {
        const dx = b.x - a.x; const dy = b.y - a.y; const lengthSq = dx * dx + dy * dy || 1
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
        return { x: a.x + t * dx, y: a.y + t * dy }
      }
      const mouseNearLine = (points: GuidePoint[], tolerance: number) => {
        let closest: GuidePoint | null = null; let bestDistance = tolerance * tolerance
        for (let index = 0; index < points.length - 1; index += 1) {
          const candidate = closestPointOnSegment({ x: pointerScreenX, y: pointerScreenY }, points[index], points[index + 1])
          const distance = (candidate.x - pointerScreenX) ** 2 + (candidate.y - pointerScreenY) ** 2
          if (distance < bestDistance) { bestDistance = distance; closest = candidate }
        }
        return closest
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
        if (!guideContext) return
        const width = host.clientWidth; const height = host.clientHeight
        guideTime += delta; guideLines = buildGuideLines(width, height)
        guideProgress = guideProgress.map((progress, index) => Math.min(1, progress + delta * (0.8 + index * 0.12)))
        guideContext.clearRect(0, 0, width, height)
        guideContext.lineCap = 'round'; guideContext.lineJoin = 'round'
        guideLines.forEach((points, lineIndex) => {
          const midpoint = Math.floor(points.length / 2)
          const span = Math.max(1, Math.round(midpoint * guideProgress[lineIndex]))
          const visiblePoints = points.slice(Math.max(0, midpoint - span), Math.min(points.length, midpoint + span + 1))
          guideContext.beginPath(); guideContext.moveTo(visiblePoints[0].x, visiblePoints[0].y); visiblePoints.slice(1).forEach((point) => guideContext.lineTo(point.x, point.y))
          const nearDistance = visiblePoints.reduce((distance, point) => Math.min(distance, Math.hypot(point.x - pointerScreenX, point.y - pointerScreenY)), Infinity)
          const mouseFade = pointerScreenX === -9999 ? 1 : 1 - 0.65 * Math.max(0, Math.min(1, nearDistance / 14))
          guideContext.strokeStyle = 'rgba(58, 70, 88, 1)'; guideContext.globalAlpha = 0.95 * mouseFade; guideContext.lineWidth = 0.85; guideContext.stroke(); guideContext.globalAlpha = 1
        })
        const linesReady = guideProgress.every((progress) => progress >= 0.995)
        if (linesReady && pointerScreenX !== -9999 && explode < 0.08 && !holding && runtime.current.transitionReady) {
          let hit: GuidePoint | null = null; let hitIndex = -1
          for (let index = 0; index < guideLines.length; index += 1) { const result = mouseNearLine(guideLines[index], 14); if (result) { hit = result; hitIndex = index; break } }
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
        if (appliedMetalness !== current.metalness || appliedRoughness !== current.roughness) {
          particles.forEach(({ mesh }) => {
            mesh.material.metalness = current.metalness
            mesh.material.roughness = current.roughness
          })
          appliedMetalness = current.metalness
          appliedRoughness = current.roughness
        }
        key.intensity = current.lightIntensity
        // These two moving warm sources are part of the live site's reflection
        // rig; their motion is what creates the broad highlights across the arms.
        fill.position.set(4 * Math.sin(elapsed * 0.6), 2 * Math.cos(elapsed * 0.4), 3 * Math.cos(elapsed * 0.5) + 2)
        warmFill.position.set(4 * Math.cos(elapsed * 0.5), 2 * Math.sin(elapsed * 0.7), 3 * Math.sin(elapsed * 0.3) - 1)
        if (!holding && shared.transitionReady) {
          rotY += prefersReducedMotion ? 0.0015 : current.rotationSpeed
          rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX))
          group.rotation.x += (rotX + pointerY * 0.22 - group.rotation.x) * 0.06
          group.rotation.y += (rotY + pointerX * 0.22 - group.rotation.y) * 0.06
        }
        explode += ((holding && shared.transitionReady ? 1 : 0) - explode) * (holding ? 0.045 : 0.08)
        shared.explodeAmt = explode

        if (mouse.x !== -9999 && scrollProgress < 0.08 && explode < 0.05 && introAmt < 0.08 && !holding && shared.transitionReady) {
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

        const driftScale = 1 - explode
        const drifts = [0, 1, 2].map((shapeIdx) => {
          const phase = shapeIdx * Math.PI * 2 / 3
          return new THREE.Vector3(Math.sin(elapsed * 0.4 + phase) * 0.012 * driftScale, Math.cos(elapsed * 0.35 + phase) * 0.008 * driftScale, Math.sin(elapsed * 0.3 + phase * 1.5) * 0.006 * driftScale)
        })
        particles.forEach(({ mesh, explodeDir, spinAxis, spinSpeed, delay, shapeIdx }) => {
          const amount = Math.max(0, explode - delay)
          mesh.position.copy(explodeDir).multiplyScalar(5.5 * amount).add(drifts[shapeIdx])
          mesh.rotation.set(spinAxis.x * spinSpeed * amount * Math.PI, spinAxis.y * spinSpeed * amount * Math.PI, spinAxis.z * spinSpeed * amount * Math.PI)
          mesh._flash = (mesh._flash ?? 0) * 0.92
          if (mesh._flash < 0.002) { mesh._flash = 0; mesh._flashActive = false }
          const flash = mesh._flash
          mesh.material.envMapIntensity = 3 + flash * 1.6
          mesh.material.roughness = Math.max(0.02, current.roughness - flash * 0.06)
          mesh.material.clearcoatRoughness = Math.max(0.01, 0.05 - flash * 0.035)
          mesh.material.transmission = 0.35 + flash * 0.32
          mesh.material.emissiveIntensity = 0.15 + flash * 0.1
          mesh.material.opacity = 0.88 - flash * 0.16
        })
        edgeLayers.forEach(({ line, shapeIdx }) => { line.position.copy(drifts[shapeIdx]); line.rotation.set(0, 0, 0) })
        group.visible = false
        if (!environmentReady || (environmentFrame++ % 6 === 0 && (holding || explode > 0.01))) {
          cubeCamera.update(renderer, scene); environmentReady = true
        }
        group.visible = true; renderer.render(scene, camera)
        drawGuidesAndSparks(delta)
        animationFrame = requestAnimationFrame(animate)
      }
      preloadHoverAudio(); preloadSparkAudio()
      host.addEventListener('pointermove', onPointerMove); host.addEventListener('pointerleave', onPointerLeave); host.addEventListener('pointerdown', onPointerDown); window.addEventListener('pointerdown', unlockAudio, { once: true }); window.addEventListener('keydown', onKeyDown, { once: true }); window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onInteractionCancel); window.addEventListener('blur', onInteractionCancel); document.addEventListener('visibilitychange', onInteractionCancel); window.addEventListener('resize', resize)
      resize(); animate()
      const cleanup = () => {
        cancelAnimationFrame(animationFrame); host.removeEventListener('pointermove', onPointerMove); host.removeEventListener('pointerleave', onPointerLeave); host.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onInteractionCancel); window.removeEventListener('blur', onInteractionCancel); document.removeEventListener('visibilitychange', onInteractionCancel); window.removeEventListener('resize', resize); renderer.dispose(); materialTemplate.dispose(); environment.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) object.geometry.dispose(); if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.LineSegments) { const objectMaterial = object.material; if (Array.isArray(objectMaterial)) objectMaterial.forEach((item) => item.dispose()); else objectMaterial.dispose() } }); if (audioContext) void audioContext.close(); renderer.domElement.remove(); guideCanvas.remove()
      }
      return cleanup
    }

    let cleanup: (() => void) | undefined
    const run = () => { cleanup = initialize() }
    if (typeof idleWindow.requestIdleCallback === 'function') idleId = idleWindow.requestIdleCallback(run, { timeout: 700 })
    else timeoutId = window.setTimeout(run, 180)
    return () => { cancelled = true; if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId); if (timeoutId !== undefined) window.clearTimeout(timeoutId); cleanup?.() }
  }, [runtime])

  return hostRef
}
