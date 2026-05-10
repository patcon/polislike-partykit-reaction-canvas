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

export default function NarrativePath3D({ points }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current!
    if (!mount || points.length === 0) return

    let cleanup: (() => void) | undefined

    const init = () => {
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

      const raw = points.map(p => [p.x, p.y, p.z] as [number, number, number])
      const normalized = normalize(raw)
      const n = normalized.length

      const positions = new Float32Array(n * 3)
      const colors = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        positions[i * 3]     = normalized[i][0]
        positions[i * 3 + 1] = normalized[i][1]
        positions[i * 3 + 2] = normalized[i][2]
        const t = n > 1 ? i / (n - 1) : 0
        // green (hue 0.33) at start → red (hue 0) at end
        const color = new THREE.Color().setHSL((1 - t) * 0.33, 1, 0.55)
        colors[i * 3]     = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.04, sizeAttenuation: true, vertexColors: true })))

      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
      lineGeo.setAttribute('color', new THREE.BufferAttribute(colors.slice(), 3))
      scene.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, opacity: 0.4, transparent: true })))

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
        cancelAnimationFrame(animId)
        controls.dispose()
        renderer.dispose()
        ro.disconnect()
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      }
    }

    if (mount.clientWidth > 0 && mount.clientHeight > 0) {
      init()
    } else {
      const ro = new ResizeObserver(() => {
        if (mount.clientWidth > 0 && mount.clientHeight > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(mount)
      cleanup = () => ro.disconnect()
    }

    return () => cleanup?.()
  }, [points])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
