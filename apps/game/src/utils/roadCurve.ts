import * as THREE from 'three'

export const roadLength = 5200
export const roadWidth = 8.8

const tau = Math.PI * 2

export function wrapDistance(distance: number) {
  return ((distance % roadLength) + roadLength) % roadLength
}

export function getRoadPoint(distance: number, wrap = false) {
  const d = wrap ? wrapDistance(distance) : THREE.MathUtils.clamp(distance, 0, roadLength - 1)
  const t = d / roadLength
  const sweep = Math.sin(tau * t * 1.15) * 42 + Math.sin(tau * t * 2.8 + 0.8) * 16
  const crest = Math.sin(tau * t * 2.0 + 0.35) * 3.8 + Math.sin(tau * t * 5.2) * 1.4

  return new THREE.Vector3(sweep, 2.8 + crest, -d)
}

export function getRoadFrame(distance: number, wrap = false) {
  const point = getRoadPoint(distance, wrap)
  const ahead = getRoadPoint(distance + 6, wrap)
  const behind = getRoadPoint(distance - 6, wrap)
  const tangent = ahead.sub(behind).normalize()
  const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize()
  const normal = new THREE.Vector3().crossVectors(right, tangent).normalize()

  return { point, tangent, right, normal }
}
