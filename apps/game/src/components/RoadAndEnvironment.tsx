import { useMemo } from 'react'
import * as THREE from 'three'
import { Bid } from '@arcade/sdk'
import Billboard from './Billboard'
import { getRoadFrame, roadLength, roadWidth } from '../utils/roadCurve'

interface RoadAndEnvironmentProps {
  textureUrl: string
  winner?: Bid
}

interface PlacedObject {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  variant: number
}

function createRoadGeometry(width: number, segments: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * roadLength
    const frame = getRoadFrame(distance)
    const crown = Math.sin((i / segments) * Math.PI * 42) * 0.018
    const left = frame.point.clone().add(frame.right.clone().multiplyScalar(-width / 2)).add(frame.normal.clone().multiplyScalar(0.05 + crown))
    const right = frame.point.clone().add(frame.right.clone().multiplyScalar(width / 2)).add(frame.normal.clone().multiplyScalar(0.05 + crown))

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z)
    uvs.push(0, distance / 30, 1, distance / 30)
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

function createTerrainGeometry(segments: number, columns: number) {
  const geometry = new THREE.BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const half = (columns - 1) / 2
  const maxOffset = 220

  for (let i = 0; i <= segments; i++) {
    const distance = (i / segments) * roadLength
    const frame = getRoadFrame(distance)
    for (let j = 0; j < columns; j++) {
      const lane = (j - half) / half
      const side = Math.sign(lane || 1)
      const offset = lane * maxOffset
      const away = Math.max(Math.abs(offset) - roadWidth * 0.58, 0)
      const roll = Math.sin(distance * 0.007 + j * 0.87) * 5 + Math.cos(distance * 0.003 + j * 1.6) * 7
      const shoulderDrop = Math.min(away * 0.06, 8)
      const p = frame.point
        .clone()
        .add(frame.right.clone().multiplyScalar(offset))
        .add(frame.normal.clone().multiplyScalar(-0.18 - shoulderDrop + roll * (away / maxOffset)))

      if (Math.abs(offset) < roadWidth * 0.64) p.y -= 0.28
      if (side !== 0 && away > 120) p.y += Math.sin(distance * 0.002 + side) * 10

      vertices.push(p.x, p.y, p.z)
      uvs.push(j / (columns - 1), i / segments)
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < columns - 1; j++) {
      const a = i * columns + j
      indices.push(a, a + 1, a + columns, a + 1, a + columns + 1, a + columns)
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createLaneMarkers(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const distance = 70 + index * 42
    const frame = getRoadFrame(distance)
    const position = frame.point.clone().add(frame.normal.clone().multiplyScalar(0.09))
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), frame.tangent)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    return {
      position: [position.x, position.y, position.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    }
  })
}

function createBillboards() {
  return Array.from({ length: 18 }, (_, index) => {
    const distance = 170 + index * 280
    const frame = getRoadFrame(distance)
    const rightSide = index % 2 === 0
    const side = rightSide ? 1 : -1
    const base = frame.point.clone().add(frame.right.clone().multiplyScalar(side * (roadWidth * 1.55 + 7 + (index % 3) * 2)))
    base.y -= 0.35
    const towardRoad = frame.point.clone().sub(base).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), towardRoad)
    const euler = new THREE.Euler().setFromQuaternion(quaternion)
    euler.y += rightSide ? -0.12 : 0.12

    return {
      position: [base.x, base.y, base.z] as [number, number, number],
      rotation: [0, euler.y, 0] as [number, number, number],
      scale: index % 5 === 0 ? 1.16 : 0.92,
    }
  })
}

function createProps(count: number): PlacedObject[] {
  return Array.from({ length: count }, (_, index) => {
    const distance = 55 + index * 29
    const frame = getRoadFrame(distance)
    const side = index % 2 === 0 ? 1 : -1
    const stagger = ((index * 17) % 42) + 18
    const position = frame.point
      .clone()
      .add(frame.right.clone().multiplyScalar(side * stagger))
      .add(frame.normal.clone().multiplyScalar(-0.25))
    return {
      position: [position.x, position.y, position.z],
      rotation: [0, Math.sin(index * 14.7) * Math.PI, 0],
      scale: 0.7 + ((index * 11) % 9) * 0.08,
      variant: index % 4,
    }
  })
}

function Tree({ prop }: { prop: PlacedObject }) {
  const trunkColor = prop.variant === 1 ? '#6f5133' : '#58452f'
  const leafColor = ['#214f32', '#2f6b39', '#496f35', '#173e31'][prop.variant]

  return (
    <group position={prop.position} rotation={prop.rotation} scale={prop.scale}>
      <mesh castShadow receiveShadow position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 2.9, 7]} />
        <meshStandardMaterial color={trunkColor} roughness={0.92} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 3.35, 0]}>
        <coneGeometry args={[1.15, 2.9, 8]} />
        <meshStandardMaterial color={leafColor} roughness={0.86} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, 4.6, -0.1]}>
        <coneGeometry args={[0.86, 2.2, 8]} />
        <meshStandardMaterial color={leafColor} roughness={0.9} />
      </mesh>
    </group>
  )
}

function RoadSign({ prop }: { prop: PlacedObject }) {
  return (
    <group position={prop.position} rotation={prop.rotation} scale={prop.scale}>
      <mesh castShadow position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 2.8, 8]} />
        <meshStandardMaterial color="#596166" roughness={0.45} metalness={0.55} />
      </mesh>
      <mesh castShadow position={[0, 2.65, 0]}>
        <boxGeometry args={[1.25, 0.55, 0.08]} />
        <meshStandardMaterial color="#d9c87a" roughness={0.38} metalness={0.05} />
      </mesh>
    </group>
  )
}

export default function RoadAndEnvironment({ textureUrl, winner }: RoadAndEnvironmentProps) {
  const roadGeometry = useMemo(() => createRoadGeometry(roadWidth, 620), [])
  const terrainGeometry = useMemo(() => createTerrainGeometry(360, 19), [])
  const markers = useMemo(() => createLaneMarkers(118), [])
  const billboards = useMemo(() => createBillboards(), [])
  const props = useMemo(() => createProps(210), [])

  return (
    <group>
      <mesh receiveShadow geometry={terrainGeometry}>
        <meshStandardMaterial color="#5f7c44" roughness={0.94} metalness={0.02} />
      </mesh>

      <mesh receiveShadow castShadow geometry={roadGeometry}>
        <meshStandardMaterial color="#2f3533" roughness={0.78} metalness={0.03} />
      </mesh>

      {markers.map((marker, index) => (
        <mesh key={index} position={marker.position} rotation={marker.rotation} receiveShadow>
          <boxGeometry args={[0.24, 0.035, 7.2]} />
          <meshStandardMaterial color="#e8dfba" roughness={0.62} />
        </mesh>
      ))}

      {billboards.map((billboard, index) => (
        <Billboard
          key={index}
          position={billboard.position}
          rotation={billboard.rotation}
          scale={billboard.scale}
          textureUrl={textureUrl}
          winner={winner}
        />
      ))}

      {props.map((prop, index) => (
        prop.variant === 3
          ? <RoadSign key={index} prop={prop} />
          : <Tree key={index} prop={prop} />
      ))}
    </group>
  )
}
