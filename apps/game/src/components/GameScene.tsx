import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import RoadAndEnvironment from './RoadAndEnvironment'
import Car, { DrivingTelemetry } from './Car'
import { Bid } from '@arcade/sdk'
import { SceneId } from './RoadAndEnvironment'
import { CarId } from '../data/cars'

interface GameSceneProps {
  textureUrl: string
  winner?: Bid
  scene: SceneId
  car: CarId
  playing: boolean
  onTelemetry: (telemetry: DrivingTelemetry) => void
}

const atmosphere: Record<SceneId, {
  background: string
  fog: string
  sun: [number, number, number]
  turbidity: number
  rayleigh: number
  hemiSky: string
  hemiGround: string
  ambient: number
}> = {
  meadow: { background: '#a8c9d8', fog: '#a8c9d8', sun: [80, 32, -90], turbidity: 1.4, rayleigh: 1.8, hemiSky: '#d8f0ff', hemiGround: '#537247', ambient: 0.78 },
  alpine: { background: '#bfd1d6', fog: '#bfd1d6', sun: [72, 38, -80], turbidity: 1.15, rayleigh: 2.0, hemiSky: '#ecf7ff', hemiGround: '#506d5c', ambient: 0.82 },
  snow: { background: '#dce8ec', fog: '#dce8ec', sun: [42, 24, -75], turbidity: 1.8, rayleigh: 2.6, hemiSky: '#f4fbff', hemiGround: '#b9cacc', ambient: 1.0 },
  autumn: { background: '#c9b08d', fog: '#c9b08d', sun: [65, 22, -88], turbidity: 2.1, rayleigh: 2.2, hemiSky: '#ffe2b8', hemiGround: '#765636', ambient: 0.86 },
  coast: { background: '#a8d2de', fog: '#a8d2de', sun: [86, 28, -60], turbidity: 2.3, rayleigh: 1.9, hemiSky: '#daf7ff', hemiGround: '#4b7a73', ambient: 0.9 },
  desert: { background: '#d9c795', fog: '#d9c795', sun: [88, 36, -72], turbidity: 3.4, rayleigh: 1.8, hemiSky: '#fff1c9', hemiGround: '#8e6c3e', ambient: 0.88 },
  dusk: { background: '#d2a184', fog: '#d2a184', sun: [-70, 18, -90], turbidity: 1.8, rayleigh: 2.5, hemiSky: '#ffd5b3', hemiGround: '#46533c', ambient: 0.72 },
}

export default function GameScene({ textureUrl, winner, scene, car, playing, onTelemetry }: GameSceneProps) {
  const mood = atmosphere[scene]
  return (
    <Canvas
      dpr={[0.85, 1.15]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 58, near: 0.1, far: 820 }}
    >
      <color attach="background" args={[mood.background]} />
      <fog attach="fog" args={[mood.fog, 130, 690]} />

      <Sky
        sunPosition={mood.sun}
        turbidity={mood.turbidity}
        rayleigh={mood.rayleigh}
        mieCoefficient={0.006}
        mieDirectionalG={0.72}
      />

      <ambientLight intensity={mood.ambient} />
      <hemisphereLight args={[mood.hemiSky, mood.hemiGround, 1.2]} />
      <directionalLight 
        position={[70, 100, -80]} 
        intensity={2.15}
      />
      
      <RoadAndEnvironment textureUrl={textureUrl} winner={winner} scene={scene} />
      <Suspense fallback={null}>
        <Car car={car} playing={playing} onTelemetry={onTelemetry} />
      </Suspense>
    </Canvas>
  )
}
