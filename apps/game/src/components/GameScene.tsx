import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import RoadAndEnvironment from './RoadAndEnvironment'
import Car, { DrivingTelemetry } from './Car'
import { Bid } from '@arcade/sdk'
import { SceneId } from './RoadAndEnvironment'

interface GameSceneProps {
  textureUrl: string
  winner?: Bid
  scene: SceneId
  onTelemetry: (telemetry: DrivingTelemetry) => void
}

export default function GameScene({ textureUrl, winner, scene, onTelemetry }: GameSceneProps) {
  return (
    <Canvas
      dpr={[0.85, 1.15]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 58, near: 0.1, far: 820 }}
    >
      <color attach="background" args={[scene === 'dusk' ? '#d2a184' : scene === 'desert' ? '#d9c795' : '#9fc5d8']} />
      <fog attach="fog" args={[scene === 'dusk' ? '#d2a184' : scene === 'desert' ? '#d9c795' : '#9fc5d8', 130, 690]} />

      <Sky
        sunPosition={scene === 'dusk' ? [-70, 18, -90] : [80, 32, -90]}
        turbidity={scene === 'desert' ? 3.4 : 1.4}
        rayleigh={scene === 'dusk' ? 2.5 : 1.8}
        mieCoefficient={0.006}
        mieDirectionalG={0.72}
      />

      <ambientLight intensity={0.78} />
      <hemisphereLight args={['#d8f0ff', '#537247', 1.2]} />
      <directionalLight 
        position={[70, 100, -80]} 
        intensity={2.15}
      />
      
      <RoadAndEnvironment textureUrl={textureUrl} winner={winner} scene={scene} />
      <Car onTelemetry={onTelemetry} />
    </Canvas>
  )
}
