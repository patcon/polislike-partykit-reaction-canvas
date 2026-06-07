import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { StoryTracerPoint } from '../types'

interface Props {
  points: StoryTracerPoint[]
  lerpAlpha?: number
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

function toNormalizedPositions(pts: StoryTracerPoint[], out: Float32Array) {
  const raw = pts.map(p => [p.x, p.y, p.z] as [number, number, number])
  const normalized = normalize(raw)
  for (let i = 0; i < normalized.length; i++) {
    out[i * 3]     = normalized[i][0]
    out[i * 3 + 1] = normalized[i][1]
    out[i * 3 + 2] = normalized[i][2]
  }
}

export default function NarrativePath3D({ points, lerpAlpha }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const updateRef = useRef<((pts: StoryTracerPoint[]) => void) | null>(null)
  const latestPointsRef = useRef(points)
  // Kept in a ref so the RAF closure always reads the current value without a restart
  const lerpAlphaRef = useRef(lerpAlpha ?? 0.12)

  useEffect(() => {
    latestPointsRef.current = points
    updateRef.current?.(points)
  }, [points])

  useEffect(() => {
    lerpAlphaRef.current = lerpAlpha ?? 0.12
  }, [lerpAlpha])

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

      // currentPos is the live animated state; targetPos is where we're lerping toward.
      // Both BufferAttributes reference currentPos so updating it updates both geometries.
      const currentPos = new Float32Array(n * 3)
      const targetPos = new Float32Array(n * 3)
      toNormalizedPositions(initialPts, currentPos)
      targetPos.set(currentPos)

      const colors = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? i / (n - 1) : 0
        const color = new THREE.Color().setHSL((1 - t) * 0.33, 1, 0.55)
        colors[i * 3]     = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }

      const posAttr = new THREE.BufferAttribute(currentPos, 3)
      const colorAttr = new THREE.BufferAttribute(colors, 3)
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', posAttr)
      geo.setAttribute('color', colorAttr)
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.04, sizeAttenuation: true, vertexColors: true })))

      // Line shares the same currentPos array so it moves in sync for free
      const linePosAttr = new THREE.BufferAttribute(currentPos, 3)
      const lineColorAttr = new THREE.BufferAttribute(colors, 3)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', linePosAttr)
      lineGeo.setAttribute('color', lineColorAttr)
      scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, opacity: 0.4, transparent: true })))

      // Only updates targetPos; the animation loop lerps currentPos toward it
      updateRef.current = (pts: StoryTracerPoint[]) => {
        if (pts.length !== n) return
        toNormalizedPositions(pts, targetPos)
      }

      if (latestPointsRef.current !== initialPts) {
        updateRef.current(latestPointsRef.current)
      }

      let animId = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        controls.update()

        // Lerp currentPos toward targetPos; mark buffers dirty only when still moving
        let moved = false
        for (let i = 0; i < currentPos.length; i++) {
          const d = targetPos[i] - currentPos[i]
          if (Math.abs(d) > 1e-5) {
            currentPos[i] += d * lerpAlphaRef.current
            moved = true
          } else {
            currentPos[i] = targetPos[i]
          }
        }
        if (moved) {
          posAttr.needsUpdate = true
          linePosAttr.needsUpdate = true
        }

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
