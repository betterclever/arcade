import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'

export default function Player() {
  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())
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
    const { camera } = state
    const moveSpeed = 20
    
    direction.current.set(0, 0, 0)
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    
    // Flatten vectors to Y=0
    forward.y = 0
    right.y = 0
    forward.normalize()
    right.normalize()

    if (keys.current['KeyW']) direction.current.add(forward)
    if (keys.current['KeyS']) direction.current.sub(forward)
    if (keys.current['KeyA']) direction.current.sub(right)
    if (keys.current['KeyD']) direction.current.add(right)

    if (direction.current.length() > 0) {
      direction.current.normalize().multiplyScalar(moveSpeed * delta)
      camera.position.add(direction.current)
    }
  })

  return <PointerLockControls />
}
