import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { driveInput, setDriveInput } from '../utils/input'
import { getRoadFrame, roadWidth, wrapDistance } from '../utils/roadCurve'
import { CarId, carOptions, getCarOption } from '../data/cars'

export interface DrivingTelemetry {
  speed: number
  steering: number
}

interface CarProps {
  car: CarId
  playing: boolean
  onTelemetry: (telemetry: DrivingTelemetry) => void
}

const keyMap: Record<string, keyof typeof driveInput> = {
  KeyW: 'accelerate',
  ArrowUp: 'accelerate',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'steerLeft',
  ArrowLeft: 'steerLeft',
  KeyD: 'steerRight',
  ArrowRight: 'steerRight',
}

function VehicleModel({ car, speed }: { car: CarId, speed: { current: number } }) {
  const option = getCarOption(car)
  const { scene } = useGLTF(option.modelUrl)
  const { model, wheelNodes } = useMemo(() => {
    const clone = scene.clone(true)
    const wheels: THREE.Object3D[] = []
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const longest = Math.max(size.x, size.y, size.z) || 1

    clone.position.sub(center)
    clone.scale.setScalar(5.05 / longest)
    clone.traverse((child) => {
      const name = child.name.toLowerCase()
      const isRoadWheel = /^wheel-(front|back)-(left|right)$/.test(name)
      if (isRoadWheel) {
        wheels.push(child)
      }
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = false
      child.receiveShadow = false

      if (name.includes('wheel')) {
        const original = Array.isArray(child.material) ? child.material[0] : child.material
        child.material = original?.clone() ?? new THREE.MeshStandardMaterial({ color: '#1d2226', roughness: 0.82, metalness: 0.04 })
        return
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const repaired = materials.map((material) => {
        const source = material as THREE.MeshStandardMaterial
        const cloneMaterial = source.clone()
        cloneMaterial.roughness = Math.max(0.38, cloneMaterial.roughness ?? 0.38)
        cloneMaterial.metalness = Math.min(0.16, cloneMaterial.metalness ?? 0.08)
        if (cloneMaterial.map) {
          cloneMaterial.map.colorSpace = THREE.SRGBColorSpace
          cloneMaterial.map.needsUpdate = true
        }
        return cloneMaterial
      })
      child.material = Array.isArray(child.material) ? repaired : repaired[0]
    })

    return { model: clone, wheelNodes: wheels }
  }, [scene, option.paint])

  useFrame((_, delta) => {
    wheelNodes.forEach((wheel) => {
      wheel.rotation.x -= speed.current * delta * 2.2
    })
  })

  return (
    <group position={[0, 0.62, 0]} rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
      <mesh position={[0, 0.98, -0.34]} rotation={[0.05, 0, 0]}>
        <boxGeometry args={car === 'suv' ? [1.35, 0.07, 0.62] : [1.22, 0.07, 0.52]} />
        <meshPhysicalMaterial color={option.glass} roughness={0.08} metalness={0.02} transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 0.9, 0.74]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={car === 'suv' ? [1.25, 0.07, 0.5] : [1.08, 0.07, 0.42]} />
        <meshPhysicalMaterial color="#2b4652" roughness={0.12} metalness={0.02} transparent opacity={0.72} />
      </mesh>
      <mesh position={[-0.56, 0.52, -1.58]}>
        <boxGeometry args={[0.34, 0.12, 0.05]} />
        <meshBasicMaterial color="#fff0be" />
      </mesh>
      <mesh position={[0.56, 0.52, -1.58]}>
        <boxGeometry args={[0.34, 0.12, 0.05]} />
        <meshBasicMaterial color="#fff0be" />
      </mesh>
      <mesh position={[-0.58, 0.56, 1.62]}>
        <boxGeometry args={[0.3, 0.12, 0.05]} />
        <meshBasicMaterial color="#b8201d" />
      </mesh>
      <mesh position={[0.58, 0.56, 1.62]}>
        <boxGeometry args={[0.3, 0.12, 0.05]} />
        <meshBasicMaterial color="#b8201d" />
      </mesh>
    </group>
  )
}

carOptions.forEach((option) => useGLTF.preload(option.modelUrl))

export default function Car({ car, playing, onTelemetry }: CarProps) {
  const option = getCarOption(car)
  const group = useRef<THREE.Group>(null)
  const smoke = useRef<THREE.Mesh[]>([])
  const distance = useRef(140)
  const speed = useRef(0)
  const lateralOffset = useRef(0)
  const steering = useRef(0)
  const lookTarget = useRef(new THREE.Vector3())
  const cameraVelocity = useRef(new THREE.Vector3())
  const telemetryClock = useRef(0)
  const initialized = useRef(false)
  const { camera } = useThree()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const inputKey = keyMap[event.code]
      if (!inputKey) return
      setDriveInput(inputKey, true)
      event.preventDefault()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const inputKey = keyMap[event.code]
      if (!inputKey) return
      setDriveInput(inputKey, false)
      event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    if (!group.current) return

    const dt = Math.min(delta, 0.045)
    const throttle = playing && driveInput.accelerate ? 1 : 0
    const brake = playing && driveInput.brake ? 1 : 0
    const steerTarget = playing ? (driveInput.steerRight ? 1 : 0) - (driveInput.steerLeft ? 1 : 0) : 0

    if (playing) {
      speed.current += throttle * option.acceleration * dt
      speed.current -= brake * option.braking * dt
      if (!throttle && !brake) {
        speed.current = THREE.MathUtils.damp(speed.current, option.cruiseSpeed, 0.82, dt)
      }
      speed.current -= Math.max(speed.current - option.cruiseSpeed * 0.82, 0) * 0.08 * dt
      speed.current = THREE.MathUtils.clamp(speed.current, 0, option.maxSpeed)
    } else {
      speed.current = THREE.MathUtils.damp(speed.current, 0, 5, dt)
    }

    steering.current = THREE.MathUtils.damp(steering.current, steerTarget, 7.5, dt)
    const steeringAuthority = THREE.MathUtils.mapLinear(speed.current, 10, option.maxSpeed, 4.8, 12.8) * option.handling
    lateralOffset.current += steering.current * steeringAuthority * dt
    lateralOffset.current = THREE.MathUtils.damp(lateralOffset.current, 0, 0.5, dt)
    lateralOffset.current = THREE.MathUtils.clamp(lateralOffset.current, -roadWidth * 0.39, roadWidth * 0.39)

    if (playing) {
      distance.current = wrapDistance(distance.current + speed.current * dt)
    }

    const frame = getRoadFrame(distance.current)
    const carPos = frame.point
      .clone()
      .add(frame.right.clone().multiplyScalar(lateralOffset.current))
      .add(frame.normal.clone().multiplyScalar(0.72))

    const forwardQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), frame.tangent)
    const roadBank = new THREE.Quaternion().setFromAxisAngle(frame.tangent, -steering.current * 0.06)
    const steerYaw = new THREE.Quaternion().setFromAxisAngle(frame.normal, -steering.current * 0.08)
    const targetQuat = forwardQuat.multiply(roadBank).multiply(steerYaw)

    group.current.position.lerp(carPos, 0.42)
    group.current.quaternion.slerp(targetQuat, 0.26)

    smoke.current.forEach((puff, index) => {
      const phase = (state.clock.elapsedTime * 0.85 + index / smoke.current.length) % 1
      puff.position.set(
        Math.sin(index * 2.2) * 0.16,
        0.68 + phase * 0.84,
        2.2 + phase * 3.1,
      )
      const size = 0.18 + phase * 0.52
      puff.scale.set(size, size * 0.72, size)
      const material = puff.material as THREE.MeshBasicMaterial
      material.opacity = Math.max(0, (1 - phase) * 0.24 * THREE.MathUtils.clamp(speed.current / 58, 0.3, 1))
    })

    const chaseDistance = THREE.MathUtils.mapLinear(speed.current, 10, option.maxSpeed, 8.4, 20)
    const chaseHeight = THREE.MathUtils.mapLinear(speed.current, 10, option.maxSpeed, 5.2 + option.cameraLift, 9.8 + option.cameraLift)
    const sideDrift = -steering.current * 1.8
    const cameraTarget = carPos
      .clone()
      .add(frame.tangent.clone().multiplyScalar(-chaseDistance))
      .add(frame.normal.clone().multiplyScalar(chaseHeight))
      .add(frame.right.clone().multiplyScalar(sideDrift))

    const lookAhead = frame.point
      .clone()
      .add(frame.tangent.clone().multiplyScalar(56 + speed.current * 0.5))
      .add(frame.normal.clone().multiplyScalar(1.15))
      .add(frame.right.clone().multiplyScalar(lateralOffset.current * 0.22))

    if (!initialized.current) {
      initialized.current = true
      group.current.position.copy(carPos)
      group.current.quaternion.copy(targetQuat)
      camera.position.copy(cameraTarget)
      lookTarget.current.copy(lookAhead)
    } else {
      cameraVelocity.current.lerp(cameraTarget.clone().sub(camera.position).multiplyScalar(0.12), 0.1)
      camera.position.add(cameraVelocity.current)
      lookTarget.current.lerp(lookAhead, 0.12)
    }
    camera.lookAt(lookTarget.current)

    telemetryClock.current += dt
    if (telemetryClock.current > 0.12) {
      telemetryClock.current = 0
      onTelemetry({ speed: speed.current, steering: steering.current })
    }

    state.camera.updateProjectionMatrix()
  })

  return (
    <group ref={group}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 5.8]} />
        <meshBasicMaterial color="#102022" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <VehicleModel car={car} speed={speed} />
      {Array.from({ length: 9 }, (_, index) => (
        <mesh
          key={`smoke-${index}`}
          ref={(node) => {
            if (node) smoke.current[index] = node
          }}
          position={[0, 0.7, 2.8 + index * 0.12]}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#d9dedb" transparent opacity={0.04} depthWrite={false} />
        </mesh>
      ))}
      <pointLight position={[-0.58, 0.62, -2.25]} color="#fff3cf" intensity={1.6} distance={15} />
      <pointLight position={[0.58, 0.62, -2.25]} color="#fff3cf" intensity={1.6} distance={15} />
    </group>
  )
}
