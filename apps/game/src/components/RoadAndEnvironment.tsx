import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Bid } from '@arcade/sdk'
import Billboard, { makeBillboardTexture } from './Billboard'
import { getRoadFrame, getRoadPoint, roadLength, roadWidth } from '../utils/roadCurve'

export type SceneId = 'meadow' | 'alpine' | 'desert' | 'dusk' | 'snow' | 'autumn' | 'coast'

interface RoadAndEnvironmentProps {
  textureUrl: string
  winner?: Bid
  scene: SceneId
}

interface PlacedObject {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  variant: number
  kind: 'tree' | 'sign' | 'rock' | 'lamp' | 'rail-post' | 'rail-beam' | 'rumble' | 'hedge' | 'fence-post' | 'fence-rail' | 'crop-row'
}

interface InstanceBatchProps {
  items: PlacedObject[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  localPosition?: [number, number, number]
  localScale?: [number, number, number]
}

const scenes: Record<SceneId, {
  terrain: string
  shoulder: string
  road: string
  line: string
  edgeLine: string
  rail: string
  hedge: string
  cropA: string
  cropB: string
  roadTextureA: string
  roadTextureB: string
  treeA: string
  treeB: string
  trunk: string
  rock: string
}> = {
  meadow: {
    terrain: '#6f9654',
    shoulder: '#a5b98a',
    road: '#f1f1ea',
    line: '#eee3bf',
    edgeLine: '#f1edcf',
    rail: '#d7d5c7',
    hedge: '#4f7a3c',
    cropA: '#aaba63',
    cropB: '#c5a957',
    roadTextureA: '#3f4a4b',
    roadTextureB: '#6d7772',
    treeA: '#1f5634',
    treeB: '#4f7b3f',
    trunk: '#5e432c',
    rock: '#777c72',
  },
  snow: {
    terrain: '#dbe8ea',
    shoulder: '#eef4f1',
    road: '#eef1ee',
    line: '#f8f2c8',
    edgeLine: '#f4f7f1',
    rail: '#cbd7d8',
    hedge: '#d7e6df',
    cropA: '#edf3ee',
    cropB: '#c7d6d7',
    roadTextureA: '#303a3c',
    roadTextureB: '#617174',
    treeA: '#153b32',
    treeB: '#6f8d80',
    trunk: '#514438',
    rock: '#b8c5c5',
  },
  autumn: {
    terrain: '#897d49',
    shoulder: '#a99a66',
    road: '#f1ece2',
    line: '#f0dcab',
    edgeLine: '#ddb15d',
    rail: '#c8b389',
    hedge: '#7d5930',
    cropA: '#b17834',
    cropB: '#d0a64a',
    roadTextureA: '#3d403c',
    roadTextureB: '#72675a',
    treeA: '#8a4f23',
    treeB: '#bd812c',
    trunk: '#5b3f2b',
    rock: '#8d806c',
  },
  coast: {
    terrain: '#6f9b70',
    shoulder: '#b1c79d',
    road: '#eef0e8',
    line: '#f3e8bd',
    edgeLine: '#f1efdd',
    rail: '#d7d4c4',
    hedge: '#466f50',
    cropA: '#90b86e',
    cropB: '#c9b873',
    roadTextureA: '#3b4647',
    roadTextureB: '#697878',
    treeA: '#245d4c',
    treeB: '#5f8757',
    trunk: '#654a31',
    rock: '#8b9188',
  },
  alpine: {
    terrain: '#6f8b74',
    shoulder: '#9dad94',
    road: '#efefe8',
    line: '#f0ead0',
    edgeLine: '#d7d6ba',
    rail: '#d2d7d2',
    hedge: '#2e5342',
    cropA: '#8ea76b',
    cropB: '#b7b58a',
    roadTextureA: '#3d4649',
    roadTextureB: '#697271',
    treeA: '#173f35',
    treeB: '#2e5b49',
    trunk: '#4d3d31',
    rock: '#9aa0a0',
  },
  desert: {
    terrain: '#c6a765',
    shoulder: '#d6bd7f',
    road: '#f1ece0',
    line: '#f2ddb0',
    edgeLine: '#d8c077',
    rail: '#c7b98c',
    hedge: '#7b7644',
    cropA: '#d5ba6c',
    cropB: '#b58a52',
    roadTextureA: '#49443c',
    roadTextureB: '#746a56',
    treeA: '#66733c',
    treeB: '#8b8a4c',
    trunk: '#6f5538',
    rock: '#a06f48',
  },
  dusk: {
    terrain: '#6f7b58',
    shoulder: '#8a966c',
    road: '#f0ece2',
    line: '#f1d89b',
    edgeLine: '#d6b35e',
    rail: '#bfc5b9',
    hedge: '#314b33',
    cropA: '#899c5a',
    cropB: '#ba9f63',
    roadTextureA: '#3c4648',
    roadTextureB: '#626b69',
    treeA: '#1d4035',
    treeB: '#405e3b',
    trunk: '#55402d',
    rock: '#81796c',
  },
}

function makeNoiseTexture(primary: string, secondary: string, size = 256, density = 2200) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = primary
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 0.2
  for (let i = 0; i < density; i++) {
    const shade = i % 3 === 0 ? secondary : '#f5f1df'
    ctx.fillStyle = shade
    const x = Math.random() * size
    const y = Math.random() * size
    const w = Math.random() * 2.6 + 0.4
    ctx.fillRect(x, y, w, 1)
  }
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 110)
  texture.anisotropy = 4
  return texture
}

function makeGroundTexture(base: string, fleck: string, size = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 0.16
  for (let i = 0; i < 850; i++) {
    ctx.fillStyle = i % 4 === 0 ? '#eef0c9' : fleck
    ctx.fillRect(Math.random() * size, Math.random() * size, Math.random() * 3 + 1, Math.random() * 2 + 1)
  }
  ctx.globalAlpha = 1

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(16, 120)
  texture.anisotropy = 2
  return texture
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function terrainHeight(x: number, z: number, scene: SceneId) {
  const distance = THREE.MathUtils.clamp(-z, 0, roadLength - 1)
  const road = getRoadPoint(distance)
  const fromRoad = Math.abs(x - road.x)
  const hillStrength = smoothstep(roadWidth * 1.8, 260, fromRoad)
  const broad = Math.sin(x * 0.012 + distance * 0.004) * 5.2
  const detail = Math.cos(x * 0.027 - distance * 0.007) * 2.1
  const sceneLift = scene === 'alpine'
    ? hillStrength * 10
    : scene === 'desert'
      ? hillStrength * 3
      : scene === 'snow'
        ? hillStrength * 7
        : scene === 'coast'
          ? hillStrength * 2.5
          : scene === 'dusk'
            ? hillStrength * 5
            : hillStrength * 4
  return road.y - 0.42 + (broad + detail + sceneLift) * hillStrength
}

function useAdTexture(textureUrl: string, winner?: Bid) {
  const fallbackLabel = winner?.company ?? winner?.bidder ?? 'Arcad(e)'
  const fallbackAmount = winner ? `$${Number(winner.amountUsd ?? winner.amount).toFixed(3)}` : 'LIVE BID'
  const [texture, setTexture] = useState<THREE.Texture>(() => makeBillboardTexture(fallbackLabel, 'agent-bid dynamic ad', fallbackAmount))

  useEffect(() => {
    let cancelled = false
    const fallback = makeBillboardTexture(fallbackLabel, winner?.prompt ?? 'agent-bid dynamic ad', fallbackAmount)

    if (!textureUrl) {
      setTexture((previous) => {
        previous.dispose()
        return fallback
      })
      return
    }

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      textureUrl,
      (loaded) => {
        if (cancelled) {
          loaded.dispose()
          return
        }
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = 2
        setTexture((previous) => {
          previous.dispose()
          return loaded
        })
        fallback.dispose()
      },
      undefined,
      () => {
        if (cancelled) {
          fallback.dispose()
          return
        }
        setTexture((previous) => {
          previous.dispose()
          return fallback
        })
      },
    )

    return () => {
      cancelled = true
    }
  }, [textureUrl, fallbackLabel, fallbackAmount, winner?.prompt])

  return texture
}

function createRoadGeometry(width: number, segments: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * (roadLength - 1)
    const frame = getRoadFrame(distance)
    const left = frame.point.clone().add(frame.right.clone().multiplyScalar(-width / 2)).add(frame.normal.clone().multiplyScalar(0.09))
    const right = frame.point.clone().add(frame.right.clone().multiplyScalar(width / 2)).add(frame.normal.clone().multiplyScalar(0.09))

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, distance / 32, 1, distance / 32)
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createRoadLineGeometry(offset: number, width: number, segments: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * (roadLength - 1)
    const frame = getRoadFrame(distance)
    const left = frame.point.clone().add(frame.right.clone().multiplyScalar(offset - width / 2)).add(frame.normal.clone().multiplyScalar(0.16))
    const right = frame.point.clone().add(frame.right.clone().multiplyScalar(offset + width / 2)).add(frame.normal.clone().multiplyScalar(0.16))
    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z)
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createShoulderGeometry(width: number, segments: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * (roadLength - 1)
    const frame = getRoadFrame(distance)
    const offsets = [-width / 2 - 3.4, -width / 2, width / 2, width / 2 + 3.4]
    offsets.forEach((offset) => {
      const p = frame.point.clone().add(frame.right.clone().multiplyScalar(offset)).add(frame.normal.clone().multiplyScalar(0.015))
      vertices.push(p.x, p.y, p.z)
    })
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 4
    indices.push(a, a + 1, a + 4, a + 1, a + 5, a + 4)
    indices.push(a + 2, a + 3, a + 6, a + 3, a + 7, a + 6)
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createTerrainGeometry(scene: SceneId) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const rows = 96
  const columns = 28
  const minX = -330
  const maxX = 330
  const minZ = -roadLength - 180
  const maxZ = 150

  for (let row = 0; row <= rows; row++) {
    const z = THREE.MathUtils.lerp(maxZ, minZ, row / rows)
    for (let column = 0; column <= columns; column++) {
      const x = THREE.MathUtils.lerp(minX, maxX, column / columns)
      vertices.push(x, terrainHeight(x, z, scene), z)
      uvs.push(column / columns, row / rows)
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column
      indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function frameRotationFromTangent(tangent: THREE.Vector3) {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tangent)
  return new THREE.Euler().setFromQuaternion(quaternion)
}

function createLaneMarkers(count: number): PlacedObject[] {
  return Array.from({ length: count }, (_, index) => {
    const distance = 46 + index * 52
    const frame = getRoadFrame(distance)
    const position = frame.point.clone().add(frame.normal.clone().multiplyScalar(0.14))
    const euler = frameRotationFromTangent(frame.tangent)
    return {
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: 1,
      variant: 0,
      kind: 'sign',
    }
  })
}

function createRumbleStrips(count: number): PlacedObject[] {
  return Array.from({ length: count * 2 }, (_, index) => {
    const pairIndex = Math.floor(index / 2)
    const side = index % 2 === 0 ? -1 : 1
    const distance = 24 + pairIndex * 34
    const frame = getRoadFrame(distance)
      const position = frame.point
      .clone()
      .add(frame.right.clone().multiplyScalar(side * (roadWidth / 2 + 0.46)))
      .add(frame.normal.clone().multiplyScalar(0.18))
    const euler = frameRotationFromTangent(frame.tangent)

    return {
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: 1,
      variant: 0,
      kind: 'rumble',
    }
  })
}

function createHedges(scene: SceneId): PlacedObject[] {
  const items: PlacedObject[] = []
  for (let index = 0; index < 92; index++) {
    const distance = 70 + index * 56
    const frame = getRoadFrame(distance)
    const euler = frameRotationFromTangent(frame.tangent)
    for (const side of [-1, 1]) {
      if ((index + side) % 5 === 0) continue
      const base = frame.point.clone().add(frame.right.clone().multiplyScalar(side * (roadWidth / 2 + 5.8)))
      base.y = terrainHeight(base.x, base.z, scene) + 0.62
      items.push({
        position: [base.x, base.y, base.z],
        rotation: [0, euler.y, 0],
        scale: 0.8 + ((index * 7) % 5) * 0.08,
        variant: index % 2,
        kind: 'hedge',
      })
    }
  }
  return items
}

function createFences(scene: SceneId): PlacedObject[] {
  const items: PlacedObject[] = []
  for (let index = 0; index < 68; index++) {
    const distance = 120 + index * 74
    const frame = getRoadFrame(distance)
    const euler = frameRotationFromTangent(frame.tangent)
    for (const side of [-1, 1]) {
      if ((index + (side > 0 ? 2 : 0)) % 4 === 0) continue
      const base = frame.point.clone().add(frame.right.clone().multiplyScalar(side * (roadWidth / 2 + 10.5)))
      base.y = terrainHeight(base.x, base.z, scene) + 0.5
      items.push({
        position: [base.x, base.y, base.z],
        rotation: [0, euler.y, 0],
        scale: 1,
        variant: 0,
        kind: 'fence-post',
      })
      items.push({
        position: [base.x, base.y + 0.55, base.z],
        rotation: [0, euler.y, 0],
        scale: 1,
        variant: 0,
        kind: 'fence-rail',
      })
    }
  }
  return items
}

function createCropRows(scene: SceneId): PlacedObject[] {
  const items: PlacedObject[] = []
  const count = scene === 'snow' ? 95 : scene === 'coast' ? 118 : 162
  for (let index = 0; index < count; index++) {
    const distance = 90 + index * 30
    const frame = getRoadFrame(distance)
    const euler = frameRotationFromTangent(frame.tangent)
    for (const side of [-1, 1]) {
      if (index % 3 === 0 && side < 0) continue
      const lane = (scene === 'coast' && side < 0 ? 44 : 26) + ((index * 13) % (scene === 'coast' ? 72 : 90))
      const base = frame.point.clone().add(frame.right.clone().multiplyScalar(side * lane))
      base.y = terrainHeight(base.x, base.z, scene) + 0.08
      items.push({
        position: [base.x, base.y, base.z],
        rotation: [0, euler.y + (side > 0 ? 0.08 : -0.08), 0],
        scale: 0.7 + ((index * 5) % 6) * 0.05,
        variant: index % 2,
        kind: 'crop-row',
      })
    }
  }
  return items
}

function createGuardrails(scene: SceneId): PlacedObject[] {
  const items: PlacedObject[] = []
  for (let index = 0; index < 58; index++) {
    const distance = 220 + index * 82
    const frame = getRoadFrame(distance)
    const curveBias = Math.abs(frame.tangent.x)
    if (curveBias < 0.05 && index % 3 !== 0) continue
    const side = index % 2 === 0 ? 1 : -1
    const euler = frameRotationFromTangent(frame.tangent)
    const base = frame.point.clone().add(frame.right.clone().multiplyScalar(side * (roadWidth / 2 + 3.5)))
    base.y = terrainHeight(base.x, base.z, scene) + 0.45
    items.push({
      position: [base.x, base.y, base.z],
      rotation: [0, euler.y, 0],
      scale: 1,
      variant: 0,
      kind: 'rail-post',
    })
    items.push({
      position: [base.x, base.y + 0.74, base.z],
      rotation: [0, euler.y, 0],
      scale: 1,
      variant: 0,
      kind: 'rail-beam',
    })
  }
  return items
}

function createBillboards(scene: SceneId) {
  return Array.from({ length: 18 }, (_, index) => {
    const distance = 245 + index * 285
    const frame = getRoadFrame(distance)
    const rightSide = index % 2 === 0
    const side = rightSide ? 1 : -1
    const offset = side * (roadWidth * 1.25 + 6 + (index % 3) * 1.6)
    const base = frame.point.clone().add(frame.right.clone().multiplyScalar(offset))
    base.y = terrainHeight(base.x, base.z, scene) + 0.18

    const approach = getRoadFrame(distance - 125).point.add(frame.right.clone().multiplyScalar(side * 2.4))
    const towardDriver = approach.sub(base).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), towardDriver)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)

    return {
      position: [base.x, base.y, base.z] as [number, number, number],
      rotation: [0, euler.y, 0] as [number, number, number],
      scale: index % 5 === 0 ? 1.18 : 1,
    }
  })
}

function createProps(count: number, scene: SceneId): PlacedObject[] {
  return Array.from({ length: count }, (_, index) => {
    const distance = 42 + index * 52
    const frame = getRoadFrame(distance)
    const side = index % 2 === 0 ? 1 : -1
    const stagger = ((index * 19) % 62) + 26
    const position = frame.point.clone().add(frame.right.clone().multiplyScalar(side * stagger))
    position.y = terrainHeight(position.x, position.z, scene) - 0.05

    const kind = scene === 'desert'
      ? (index % 5 === 0 ? 'sign' : index % 3 === 0 ? 'rock' : 'tree')
      : scene === 'snow'
        ? (index % 7 === 0 ? 'sign' : index % 4 === 0 ? 'rock' : 'tree')
        : scene === 'coast'
          ? (index % 7 === 0 ? 'sign' : index % 3 === 0 ? 'rock' : 'tree')
          : (index % 8 === 0 ? 'lamp' : index % 6 === 0 ? 'sign' : index % 5 === 0 ? 'rock' : 'tree')

    return {
      position: [position.x, position.y, position.z],
      rotation: [0, Math.sin(index * 14.7) * Math.PI, 0],
      scale: 0.72 + ((index * 11) % 9) * 0.07,
      variant: index % 4,
      kind,
    }
  })
}

function InstanceBatch({ items, geometry, material, localPosition = [0, 0, 0], localScale = [1, 1, 1] }: InstanceBatchProps) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return

    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const position = new THREE.Vector3()
    const local = new THREE.Vector3(...localPosition)
    const scale = new THREE.Vector3()

    items.forEach((item, index) => {
      const euler = new THREE.Euler(...item.rotation)
      quaternion.setFromEuler(euler)
      position.set(...item.position).add(local.clone().multiplyScalar(item.scale).applyQuaternion(quaternion))
      scale.set(localScale[0] * item.scale, localScale[1] * item.scale, localScale[2] * item.scale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(index, matrix)
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, localPosition, localScale])

  if (items.length === 0) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled />
}

export default function RoadAndEnvironment({ textureUrl, winner, scene }: RoadAndEnvironmentProps) {
  const theme = scenes[scene]
  const adTexture = useAdTexture(textureUrl, winner)
  const roadGeometry = useMemo(() => createRoadGeometry(roadWidth, 420), [])
  const leftEdgeGeometry = useMemo(() => createRoadLineGeometry(-roadWidth / 2 + 0.32, 0.13, 420), [])
  const rightEdgeGeometry = useMemo(() => createRoadLineGeometry(roadWidth / 2 - 0.32, 0.13, 420), [])
  const shoulderGeometry = useMemo(() => createShoulderGeometry(roadWidth, 420), [])
  const terrainGeometry = useMemo(() => createTerrainGeometry(scene), [scene])
  const markers = useMemo(() => createLaneMarkers(96), [])
  const rumbleStrips = useMemo(() => createRumbleStrips(138), [])
  const guardrails = useMemo(() => createGuardrails(scene), [scene])
  const hedges = useMemo(() => createHedges(scene), [scene])
  const fences = useMemo(() => createFences(scene), [scene])
  const cropRows = useMemo(() => createCropRows(scene), [scene])
  const billboards = useMemo(() => createBillboards(scene), [scene])
  const props = useMemo(() => createProps(98, scene), [scene])

  const treeProps = useMemo(() => props.filter((prop) => prop.kind === 'tree'), [props])
  const signProps = useMemo(() => props.filter((prop) => prop.kind === 'sign'), [props])
  const rockProps = useMemo(() => props.filter((prop) => prop.kind === 'rock'), [props])
  const lampProps = useMemo(() => props.filter((prop) => prop.kind === 'lamp'), [props])
  const railPosts = useMemo(() => guardrails.filter((prop) => prop.kind === 'rail-post'), [guardrails])
  const railBeams = useMemo(() => guardrails.filter((prop) => prop.kind === 'rail-beam'), [guardrails])
  const fencePosts = useMemo(() => fences.filter((prop) => prop.kind === 'fence-post'), [fences])
  const fenceRails = useMemo(() => fences.filter((prop) => prop.kind === 'fence-rail'), [fences])
  const cropRowsA = useMemo(() => cropRows.filter((prop) => prop.variant === 0), [cropRows])
  const cropRowsB = useMemo(() => cropRows.filter((prop) => prop.variant === 1), [cropRows])

  const geometries = useMemo(() => ({
    marker: new THREE.BoxGeometry(0.24, 0.035, 6.4),
    rumble: new THREE.BoxGeometry(0.86, 0.035, 0.28),
    hedge: new THREE.DodecahedronGeometry(1, 0),
    fencePost: new THREE.BoxGeometry(0.14, 1.1, 0.14),
    fenceRail: new THREE.BoxGeometry(0.11, 0.12, 7.4),
    cropRow: new THREE.BoxGeometry(0.36, 0.08, 11.5),
    railPost: new THREE.BoxGeometry(0.16, 1.1, 0.16),
    railBeam: new THREE.BoxGeometry(0.18, 0.28, 10.5),
    trunk: new THREE.CylinderGeometry(0.16, 0.25, 2.7, 6),
    treeCrown: new THREE.ConeGeometry(1.05, 2.65, 7),
    treeTop: new THREE.ConeGeometry(0.78, 1.9, 7),
    rock: new THREE.DodecahedronGeometry(0.72, 0),
    signPole: new THREE.CylinderGeometry(0.055, 0.075, 2.7, 6),
    signFace: new THREE.BoxGeometry(1.25, 0.52, 0.08),
    lampPole: new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6),
    lampArm: new THREE.BoxGeometry(0.85, 0.16, 0.24),
  }), [])

  const textures = useMemo(() => ({
    road: makeNoiseTexture(theme.roadTextureA, theme.roadTextureB),
    ground: makeGroundTexture(theme.terrain, theme.shoulder),
  }), [theme])

  const materials = useMemo(() => ({
    marker: new THREE.MeshBasicMaterial({ color: theme.line }),
    edge: new THREE.MeshBasicMaterial({ color: theme.edgeLine }),
    rumble: new THREE.MeshBasicMaterial({ color: '#cfc5a5' }),
    hedge: new THREE.MeshLambertMaterial({ color: theme.hedge }),
    fence: new THREE.MeshLambertMaterial({ color: scene === 'desert' ? '#9d7b55' : scene === 'snow' ? '#c4bca6' : '#896a46' }),
    cropA: new THREE.MeshLambertMaterial({ color: theme.cropA }),
    cropB: new THREE.MeshLambertMaterial({ color: theme.cropB }),
    terrain: new THREE.MeshLambertMaterial({ color: theme.terrain, map: textures.ground }),
    shoulder: new THREE.MeshLambertMaterial({ color: theme.shoulder }),
    water: new THREE.MeshBasicMaterial({ color: '#6fb7c7', transparent: true, opacity: 0.62 }),
    snowMist: new THREE.MeshBasicMaterial({ color: '#eef7f8', transparent: true, opacity: 0.24, depthWrite: false }),
    road: new THREE.MeshLambertMaterial({ color: theme.road, map: textures.road }),
    trunk: new THREE.MeshLambertMaterial({ color: theme.trunk }),
    treeA: new THREE.MeshLambertMaterial({ color: scene === 'desert' ? theme.treeA : theme.treeA }),
    treeB: new THREE.MeshLambertMaterial({ color: scene === 'desert' ? theme.treeB : theme.treeB }),
    rock: new THREE.MeshLambertMaterial({ color: theme.rock }),
    metal: new THREE.MeshLambertMaterial({ color: '#596166' }),
    rail: new THREE.MeshLambertMaterial({ color: theme.rail }),
    sign: new THREE.MeshLambertMaterial({ color: theme.line }),
  }), [scene, theme, textures])

  return (
    <group>
      {scene === 'coast' && (
        <mesh position={[-210, -0.85, -roadLength / 2]} rotation={[-Math.PI / 2, 0, 0]} matrixAutoUpdate={false}>
          <planeGeometry args={[260, roadLength + 620]} />
          <primitive object={materials.water} attach="material" />
        </mesh>
      )}
      {scene === 'snow' && (
        <mesh position={[0, 0.35, -roadLength / 2]} rotation={[-Math.PI / 2, 0, 0]} matrixAutoUpdate={false}>
          <planeGeometry args={[660, roadLength + 260]} />
          <primitive object={materials.snowMist} attach="material" />
        </mesh>
      )}
      <mesh geometry={terrainGeometry} material={materials.terrain} matrixAutoUpdate={false} />
      <mesh geometry={shoulderGeometry} material={materials.shoulder} matrixAutoUpdate={false} />
      <mesh geometry={roadGeometry} material={materials.road} matrixAutoUpdate={false} />
      <mesh geometry={leftEdgeGeometry} material={materials.edge} matrixAutoUpdate={false} />
      <mesh geometry={rightEdgeGeometry} material={materials.edge} matrixAutoUpdate={false} />

      <InstanceBatch items={markers} geometry={geometries.marker} material={materials.marker} />
      <InstanceBatch items={rumbleStrips} geometry={geometries.rumble} material={materials.rumble} />
      <InstanceBatch items={railPosts} geometry={geometries.railPost} material={materials.rail} />
      <InstanceBatch items={railBeams} geometry={geometries.railBeam} material={materials.rail} />
      <InstanceBatch items={hedges} geometry={geometries.hedge} material={materials.hedge} localScale={[1.55, 0.46, 1.25]} />
      <InstanceBatch items={fencePosts} geometry={geometries.fencePost} material={materials.fence} />
      <InstanceBatch items={fenceRails} geometry={geometries.fenceRail} material={materials.fence} />
      <InstanceBatch items={cropRowsA} geometry={geometries.cropRow} material={materials.cropA} />
      <InstanceBatch items={cropRowsB} geometry={geometries.cropRow} material={materials.cropB} />

      {billboards.map((billboard, index) => (
        <Billboard
          key={index}
          position={billboard.position}
          rotation={billboard.rotation}
          scale={billboard.scale}
          texture={adTexture}
        />
      ))}

      <InstanceBatch items={treeProps} geometry={geometries.trunk} material={materials.trunk} localPosition={[0, 1.35, 0]} />
      <InstanceBatch items={treeProps} geometry={geometries.treeCrown} material={materials.treeA} localPosition={[0, 3.05, 0]} />
      <InstanceBatch items={treeProps} geometry={geometries.treeTop} material={materials.treeB} localPosition={[0.12, 4.15, -0.08]} />
      <InstanceBatch items={rockProps} geometry={geometries.rock} material={materials.rock} localPosition={[0, 0.28, 0]} />
      <InstanceBatch items={signProps} geometry={geometries.signPole} material={materials.metal} localPosition={[0, 1.35, 0]} />
      <InstanceBatch items={signProps} geometry={geometries.signFace} material={materials.sign} localPosition={[0, 2.55, 0]} />
      <InstanceBatch items={lampProps} geometry={geometries.lampPole} material={materials.metal} localPosition={[0, 2.1, 0]} />
      <InstanceBatch items={lampProps} geometry={geometries.lampArm} material={materials.metal} localPosition={[0.42, 4.15, 0]} />
    </group>
  )
}
