import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { PointerLockControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

export default function VTOL() {
  const group = useRef<THREE.Group>(null)
  const velocity = useRef(new THREE.Vector3())
  const rotation = useRef(new THREE.Euler(0, 0, 0))
  const keys = useRef<{ [key: string]: boolean }>({})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    if (!group.current) return

    const { camera } = state
    const accel = 30
    const drag = 0.95
    const tiltSpeed = 2
    
    // Vertical Movement (Space/Shift)
    if (keys.current['Space']) velocity.current.y += accel * delta
    if (keys.current['ShiftLeft']) velocity.current.y -= accel * delta

    // Directional vectors based on camera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    
    // Flatten for horizontal movement
    const horizontalForward = forward.clone().setY(0).normalize()
    const horizontalRight = right.clone().setY(0).normalize()

    if (keys.current['KeyW']) velocity.current.add(horizontalForward.multiplyScalar(accel * delta))
    if (keys.current['KeyS']) velocity.current.sub(horizontalForward.multiplyScalar(accel * delta))
    if (keys.current['KeyA']) velocity.current.sub(horizontalRight.multiplyScalar(accel * delta))
    if (keys.current['KeyD']) velocity.current.add(horizontalRight.multiplyScalar(accel * delta))

    // Apply Velocity
    group.current.position.add(velocity.current.clone().multiplyScalar(delta))
    velocity.current.multiplyScalar(drag)

    // Visual Tilt effect based on velocity
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -velocity.current.z * 0.05, 0.1)
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, -velocity.current.x * 0.05, 0.1)

    // Camera follows the VTOL
    camera.position.lerp(
      group.current.position.clone().add(new THREE.Vector3(0, 2, 8).applyQuaternion(camera.quaternion)),
      0.1
    )
  })

  return (
    <>
      <group ref={group}>
        {/* VTOL Body Placeholder */}
        <mesh castShadow>
          <boxGeometry args={[1, 0.5, 2]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Wings/Thrusters */}
        <mesh position={[1, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[-1, 0, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </group>
      <PointerLockControls />
    </>
  )
}
