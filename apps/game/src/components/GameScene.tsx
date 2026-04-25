import { Canvas } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import RoadAndEnvironment from './RoadAndEnvironment'
import Car, { DrivingTelemetry } from './Car'
import { Bid } from '@arcade/sdk'

interface GameSceneProps {
  textureUrl: string
  winner?: Bid
  onTelemetry: (telemetry: DrivingTelemetry) => void
}

export default function GameScene({ textureUrl, winner, onTelemetry }: GameSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 58, near: 0.1, far: 900 }}>
      <color attach="background" args={['#9fc5d8']} />
      <fog attach="fog" args={['#9fc5d8', 110, 640]} />

      <Sky sunPosition={[80, 32, -90]} turbidity={1.4} rayleigh={1.8} mieCoefficient={0.006} mieDirectionalG={0.72} />

      <ambientLight intensity={0.78} />
      <hemisphereLight args={['#d8f0ff', '#537247', 1.2]} />
      <directionalLight 
        position={[70, 100, -80]} 
        intensity={2.4} 
        castShadow 
        shadow-mapSize={[2048, 2048]} 
        shadow-camera-near={10} 
        shadow-camera-far={420} 
        shadow-camera-left={-120} 
        shadow-camera-right={120} 
        shadow-camera-top={120} 
        shadow-camera-bottom={-120} 
      />
      
      <RoadAndEnvironment textureUrl={textureUrl} winner={winner} />
      <Car onTelemetry={onTelemetry} />

      <Environment preset="park" />
    </Canvas>
  )
}
