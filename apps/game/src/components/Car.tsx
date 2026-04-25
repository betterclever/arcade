import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { driveInput, setDriveInput } from '../utils/input'
import { getRoadFrame, roadWidth, wrapDistance } from '../utils/roadCurve'

export interface DrivingTelemetry {
  speed: number
  steering: number
}

interface CarProps {
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

export default function Car({ onTelemetry }: CarProps) {
  const group = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group[]>([])
  const distance = useRef(140)
  const speed = useRef(34)
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
    const throttle = driveInput.accelerate ? 1 : 0
    const brake = driveInput.brake ? 1 : 0
    const steerTarget = (driveInput.steerRight ? 1 : 0) - (driveInput.steerLeft ? 1 : 0)

    speed.current += throttle * 32 * dt
    speed.current -= brake * 46 * dt
    speed.current -= Math.max(speed.current - 24, 0) * 0.12 * dt
    speed.current = THREE.MathUtils.clamp(speed.current, 10, 86)

    steering.current = THREE.MathUtils.damp(steering.current, steerTarget, 7.5, dt)
    const steeringAuthority = THREE.MathUtils.mapLinear(speed.current, 10, 86, 4.5, 11)
    lateralOffset.current += steering.current * steeringAuthority * dt
    lateralOffset.current = THREE.MathUtils.damp(lateralOffset.current, 0, 0.58, dt)
    lateralOffset.current = THREE.MathUtils.clamp(lateralOffset.current, -roadWidth * 0.39, roadWidth * 0.39)

    distance.current = wrapDistance(distance.current + speed.current * dt)

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

    wheels.current.forEach((wheel, index) => {
      wheel.rotation.x -= speed.current * dt * 1.9
      if (index < 2) wheel.rotation.y = -steering.current * 0.28
    })

    const chaseDistance = THREE.MathUtils.mapLinear(speed.current, 10, 86, 10.5, 16)
    const chaseHeight = THREE.MathUtils.mapLinear(speed.current, 10, 86, 6.2, 8.6)
    const sideDrift = -steering.current * 1.8
    const cameraTarget = carPos
      .clone()
      .add(frame.tangent.clone().multiplyScalar(-chaseDistance))
      .add(frame.normal.clone().multiplyScalar(chaseHeight))
      .add(frame.right.clone().multiplyScalar(sideDrift))

    const lookAhead = frame.point
      .clone()
      .add(frame.tangent.clone().multiplyScalar(54 + speed.current * 0.42))
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
        <planeGeometry args={[3.2, 5.4]} />
        <meshBasicMaterial color="#102022" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.56, 0.1]}>
        <boxGeometry args={[2.22, 0.62, 4.1]} />
        <meshPhysicalMaterial color="#d94932" roughness={0.42} metalness={0.12} clearcoat={0.75} clearcoatRoughness={0.28} />
      </mesh>
      <mesh position={[0, 0.83, -1.15]}>
        <boxGeometry args={[1.78, 0.36, 1.1]} />
        <meshPhysicalMaterial color="#e65b3d" roughness={0.34} metalness={0.1} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, 1.08, 0.1]}>
        <boxGeometry args={[1.5, 0.58, 1.92]} />
        <meshPhysicalMaterial color="#172b35" roughness={0.18} metalness={0.15} clearcoat={0.5} clearcoatRoughness={0.1} />
      </mesh>
      <mesh position={[0, 1.27, -0.78]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[1.28, 0.08, 0.72]} />
        <meshPhysicalMaterial color="#8fb7c0" roughness={0.04} metalness={0.02} transparent opacity={0.74} />
      </mesh>
      <mesh position={[0, 1.2, 0.98]} rotation={[-0.14, 0, 0]}>
        <boxGeometry args={[1.22, 0.08, 0.56]} />
        <meshPhysicalMaterial color="#2f4c57" roughness={0.08} metalness={0.02} transparent opacity={0.68} />
      </mesh>
      <mesh position={[0, 0.88, 1.72]}>
        <boxGeometry args={[1.94, 0.24, 0.35]} />
        <meshStandardMaterial color="#f26a45" roughness={0.34} metalness={0.16} />
      </mesh>
      <mesh position={[-0.62, 0.58, -2.04]}>
        <boxGeometry args={[0.42, 0.13, 0.06]} />
        <meshBasicMaterial color="#fff0b8" />
      </mesh>
      <mesh position={[0.62, 0.58, -2.04]}>
        <boxGeometry args={[0.42, 0.13, 0.06]} />
        <meshBasicMaterial color="#fff0b8" />
      </mesh>
      <mesh position={[-0.72, 0.62, 2.17]}>
        <boxGeometry args={[0.36, 0.14, 0.06]} />
        <meshBasicMaterial color="#b8221f" />
      </mesh>
      <mesh position={[0.72, 0.62, 2.17]}>
        <boxGeometry args={[0.36, 0.14, 0.06]} />
        <meshBasicMaterial color="#b8221f" />
      </mesh>
      {[
        [-1.17, 0.18, -1.45],
        [1.17, 0.18, -1.45],
        [-1.17, 0.18, 1.35],
        [1.17, 0.18, 1.35],
      ].map((position, index) => (
        <group key={index} ref={(node) => {
          if (node) wheels.current[index] = node
        }} position={position as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.43, 0.43, 0.36, 20]} />
            <meshStandardMaterial color="#1e2325" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
            <meshStandardMaterial color="#c9d1d2" roughness={0.35} metalness={0.5} />
          </mesh>
        </group>
      ))}
      <pointLight position={[-0.58, 0.62, -2.25]} color="#fff3cf" intensity={1.6} distance={15} />
      <pointLight position={[0.58, 0.62, -2.25]} color="#fff3cf" intensity={1.6} distance={15} />
    </group>
  )
}
