import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Bid } from '@arcade/sdk'
import Billboard, { makeBillboardTexture } from './Billboard'
import { getRoadFrame, getRoadPoint, roadLength, roadWidth } from '../utils/roadCurve'

export type SceneId = 'meadow' | 'alpine' | 'desert' | 'dusk'

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
  kind: 'tree' | 'sign' | 'rock' | 'lamp'
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
  treeA: string
  treeB: string
  trunk: string
  rock: string
}> = {
  meadow: {
    terrain: '#84a96e',
    shoulder: '#9bb983',
    road: '#364244',
    line: '#eee3bf',
    treeA: '#1f5634',
    treeB: '#4f7b3f',
    trunk: '#5e432c',
    rock: '#777c72',
  },
  alpine: {
    terrain: '#6f8b74',
    shoulder: '#9dad94',
    road: '#30393e',
    line: '#f0ead0',
    treeA: '#173f35',
    treeB: '#2e5b49',
    trunk: '#4d3d31',
    rock: '#9aa0a0',
  },
  desert: {
    terrain: '#c6a765',
    shoulder: '#d6bd7f',
    road: '#3d3a35',
    line: '#f2ddb0',
    treeA: '#66733c',
    treeB: '#8b8a4c',
    trunk: '#6f5538',
    rock: '#a06f48',
  },
  dusk: {
    terrain: '#6f7b58',
    shoulder: '#8a966c',
    road: '#343d40',
    line: '#f1d89b',
    treeA: '#1d4035',
    treeB: '#405e3b',
    trunk: '#55402d',
    rock: '#81796c',
  },
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function terrainHeight(x: number, z: number, scene: SceneId) {
  const distance = THREE.MathUtils.clamp(-z, 0, roadLength)
  const road = getRoadPoint(distance)
  const fromRoad = Math.abs(x - road.x)
  const hillStrength = smoothstep(roadWidth * 1.8, 260, fromRoad)
  const broad = Math.sin(x * 0.012 + distance * 0.004) * 5.2
  const detail = Math.cos(x * 0.027 - distance * 0.007) * 2.1
  const sceneLift = scene === 'alpine' ? hillStrength * 10 : scene === 'desert' ? hillStrength * 3 : scene === 'dusk' ? hillStrength * 5 : hillStrength * 4
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
    const distance = (i / segments) * roadLength
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

function createShoulderGeometry(width: number, segments: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * roadLength
    const frame = getRoadFrame(distance)
    const offsets = [-width / 2 - 4.8, -width / 2, width / 2, width / 2 + 4.8]
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

function createBillboards(scene: SceneId) {
  return Array.from({ length: 18 }, (_, index) => {
    const distance = 245 + index * 285
    const frame = getRoadFrame(distance)
    const rightSide = index % 2 === 0
    const side = rightSide ? 1 : -1
    const offset = side * (roadWidth * 1.2 + 6.5 + (index % 3) * 1.8)
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
  const shoulderGeometry = useMemo(() => createShoulderGeometry(roadWidth, 420), [])
  const terrainGeometry = useMemo(() => createTerrainGeometry(scene), [scene])
  const markers = useMemo(() => createLaneMarkers(96), [])
  const billboards = useMemo(() => createBillboards(scene), [scene])
  const props = useMemo(() => createProps(118, scene), [scene])

  const treeProps = useMemo(() => props.filter((prop) => prop.kind === 'tree'), [props])
  const signProps = useMemo(() => props.filter((prop) => prop.kind === 'sign'), [props])
  const rockProps = useMemo(() => props.filter((prop) => prop.kind === 'rock'), [props])
  const lampProps = useMemo(() => props.filter((prop) => prop.kind === 'lamp'), [props])

  const geometries = useMemo(() => ({
    marker: new THREE.BoxGeometry(0.24, 0.035, 6.4),
    trunk: new THREE.CylinderGeometry(0.16, 0.25, 2.7, 6),
    treeCrown: new THREE.ConeGeometry(1.05, 2.65, 7),
    treeTop: new THREE.ConeGeometry(0.78, 1.9, 7),
    rock: new THREE.DodecahedronGeometry(0.72, 0),
    signPole: new THREE.CylinderGeometry(0.055, 0.075, 2.7, 6),
    signFace: new THREE.BoxGeometry(1.25, 0.52, 0.08),
    lampPole: new THREE.CylinderGeometry(0.06, 0.08, 4.2, 6),
    lampArm: new THREE.BoxGeometry(0.85, 0.16, 0.24),
  }), [])

  const materials = useMemo(() => ({
    marker: new THREE.MeshBasicMaterial({ color: theme.line }),
    terrain: new THREE.MeshLambertMaterial({ color: theme.terrain }),
    shoulder: new THREE.MeshLambertMaterial({ color: theme.shoulder }),
    road: new THREE.MeshLambertMaterial({ color: theme.road }),
    trunk: new THREE.MeshLambertMaterial({ color: theme.trunk }),
    treeA: new THREE.MeshLambertMaterial({ color: scene === 'desert' ? theme.treeA : theme.treeA }),
    treeB: new THREE.MeshLambertMaterial({ color: scene === 'desert' ? theme.treeB : theme.treeB }),
    rock: new THREE.MeshLambertMaterial({ color: theme.rock }),
    metal: new THREE.MeshLambertMaterial({ color: '#596166' }),
    sign: new THREE.MeshLambertMaterial({ color: theme.line }),
  }), [scene, theme])

  return (
    <group>
      <mesh geometry={terrainGeometry} material={materials.terrain} />
      <mesh geometry={shoulderGeometry} material={materials.shoulder} />
      <mesh geometry={roadGeometry} material={materials.road} />

      <InstanceBatch items={markers} geometry={geometries.marker} material={materials.marker} />

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
