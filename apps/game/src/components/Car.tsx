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

    const chaseDistance = THREE.MathUtils.mapLinear(speed.current, 10, 86, 12, 19)
    const chaseHeight = THREE.MathUtils.mapLinear(speed.current, 10, 86, 4.7, 6.3)
    const sideDrift = -steering.current * 1.8
    const cameraTarget = carPos
      .clone()
      .add(frame.tangent.clone().multiplyScalar(-chaseDistance))
      .add(frame.normal.clone().multiplyScalar(chaseHeight))
      .add(frame.right.clone().multiplyScalar(sideDrift))

    cameraVelocity.current.lerp(cameraTarget.sub(camera.position).multiplyScalar(0.12), 0.1)
    camera.position.add(cameraVelocity.current)

    const lookAhead = frame.point
      .clone()
      .add(frame.tangent.clone().multiplyScalar(54 + speed.current * 0.42))
      .add(frame.normal.clone().multiplyScalar(1.4))
      .add(frame.right.clone().multiplyScalar(lateralOffset.current * 0.22))
    lookTarget.current.lerp(lookAhead, 0.12)
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
      <mesh castShadow receiveShadow position={[0, 0.6, 0]}>
        <boxGeometry args={[2.18, 0.7, 4.25]} />
        <meshStandardMaterial color="#e34d3e" roughness={0.36} metalness={0.28} />
      </mesh>
      <mesh castShadow position={[0, 1.06, -0.35]}>
        <boxGeometry args={[1.58, 0.55, 2.05]} />
        <meshStandardMaterial color="#202a2e" roughness={0.18} metalness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 0.98, 1.32]}>
        <boxGeometry args={[1.92, 0.36, 0.88]} />
        <meshStandardMaterial color="#f16a48" roughness={0.32} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.22, -1.06]}>
        <boxGeometry args={[1.34, 0.1, 0.78]} />
        <meshStandardMaterial color="#8fb4bd" roughness={0.06} metalness={0.05} transparent opacity={0.72} />
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
          <mesh castShadow>
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
