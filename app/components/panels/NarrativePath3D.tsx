import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { StoryTracerPoint } from '../../types'

interface Props {
  points: StoryTracerPoint[]
}

function normalize(pts: [number, number, number][]): [number, number, number][] {
  const mins: [number, number, number] = [Infinity, Infinity, Infinity]
  const maxs: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const p of pts) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < mins[i]) mins[i] = p[i]
      if (p[i] > maxs[i]) maxs[i] = p[i]
    }
  }
  return pts.map(p =>
    p.map((v, i) => {
      const range = maxs[i] - mins[i]
      return range === 0 ? 0 : ((v - mins[i]) / range) * 2 - 1
    }) as [number, number, number]
  )
}

function buildBuffers(pts: StoryTracerPoint[]): { positions: Float32Array; colors: Float32Array } {
  const raw = pts.map(p => [p.x, p.y, p.z] as [number, number, number])
  const normalized = normalize(raw)
  const n = normalized.length
  const positions = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    positions[i * 3]     = normalized[i][0]
    positions[i * 3 + 1] = normalized[i][1]
    positions[i * 3 + 2] = normalized[i][2]
    const t = n > 1 ? i / (n - 1) : 0
    const color = new THREE.Color().setHSL((1 - t) * 0.33, 1, 0.55)
    colors[i * 3]     = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }
  return { positions, colors }
}

export default function NarrativePath3D({ points }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  // Holds the in-place update function once the scene is initialized
  const updateRef = useRef<((pts: StoryTracerPoint[]) => void) | null>(null)
  // Always tracks the latest points so delayed init can apply them immediately
  const latestPointsRef = useRef(points)

  // Keep latestPointsRef current and propagate to scene if already initialized
  useEffect(() => {
    latestPointsRef.current = points
    updateRef.current?.(points)
  }, [points])

  // Initialize Three.js scene once on mount; update geometry in-place via updateRef
  useEffect(() => {
    const mount = mountRef.current!
    if (!mount) return

    let cleanup: (() => void) | undefined

    const init = (initialPts: StoryTracerPoint[]) => {
      if (initialPts.length === 0) return
      const n = initialPts.length
      const w = mount.clientWidth
      const h = mount.clientHeight

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setClearColor(new THREE.Color('#0f0f0e'))
      mount.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.01, 100)
      camera.position.set(0, 0, 4)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08

      const { positions, colors } = buildBuffers(initialPts)

      const posAttr = new THREE.BufferAttribute(positions, 3)
      const colorAttr = new THREE.BufferAttribute(colors, 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', posAttr)
      geo.setAttribute('color', colorAttr)
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.04, sizeAttenuation: true, vertexColors: true })))

      const linePosAttr = new THREE.BufferAttribute(positions.slice(), 3)
      const lineColorAttr = new THREE.BufferAttribute(colors.slice(), 3)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', linePosAttr)
      lineGeo.setAttribute('color', lineColorAttr)
      scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, opacity: 0.4, transparent: true })))

      updateRef.current = (pts: StoryTracerPoint[]) => {
        if (pts.length !== n) return
        const { positions: newPos, colors: newColors } = buildBuffers(pts)
        posAttr.array.set(newPos)
        posAttr.needsUpdate = true
        colorAttr.array.set(newColors)
        colorAttr.needsUpdate = true
        linePosAttr.array.set(newPos)
        linePosAttr.needsUpdate = true
        lineColorAttr.array.set(newColors)
        lineColorAttr.needsUpdate = true
      }

      // Apply any points that arrived while init was pending (delayed-mount path)
      if (latestPointsRef.current !== initialPts) {
        updateRef.current(latestPointsRef.current)
      }

      let animId = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const ro = new ResizeObserver(() => {
        const nw = mount.clientWidth
        const nh = mount.clientHeight
        renderer.setSize(nw, nh)
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
      })
      ro.observe(mount)

      cleanup = () => {
        updateRef.current = null
        cancelAnimationFrame(animId)
        controls.dispose()
        renderer.dispose()
        ro.disconnect()
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      }
    }

    const initialPts = latestPointsRef.current
    if (mount.clientWidth > 0 && mount.clientHeight > 0) {
      init(initialPts)
    } else {
      const ro = new ResizeObserver(() => {
        if (mount.clientWidth > 0 && mount.clientHeight > 0) {
          ro.disconnect()
          init(latestPointsRef.current)
        }
      })
      ro.observe(mount)
      cleanup = () => ro.disconnect()
    }

    return () => cleanup?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
