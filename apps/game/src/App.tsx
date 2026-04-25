import { useState, useEffect, useMemo } from 'react'
import { ArcadeSDK, Bid } from '@arcade/sdk'
import GameScene from './components/GameScene'
import HUD from './components/HUD'
import { DrivingTelemetry } from './components/Car'
import { SceneId } from './components/RoadAndEnvironment'
import './App.css'

function App() {
  const sdk = useMemo(() => new ArcadeSDK({
    mock: import.meta.env.VITE_ARCADE_MOCK !== 'false',
    baseUrl: import.meta.env.VITE_ARCADE_API_URL ?? 'http://localhost:8787/api',
    surfaceId: import.meta.env.VITE_ARCADE_SURFACE_ID ?? 'raceway-billboard-main',
  }), [])
  const [bids, setBids] = useState<Bid[]>([])
  const [textureUrl, setTextureUrl] = useState<string>('https://picsum.photos/seed/arcade-open-road/1024/512')
  const [telemetry, setTelemetry] = useState<DrivingTelemetry>({ speed: 34, steering: 0 })
  const [scene, setScene] = useState<SceneId>('meadow')

  useEffect(() => {
    const unsubBids = sdk.subscribeToBids(setBids)
    const unsubTexture = sdk.subscribeToTextureUpdates(setTextureUrl)

    return () => {
      unsubBids()
      unsubTexture()
      sdk.stop()
    }
  }, [sdk])

  return (
    <div className="arcade-shell">
      <GameScene textureUrl={textureUrl} winner={bids[0]} scene={scene} onTelemetry={setTelemetry} />
      <HUD bids={bids} sdk={sdk} telemetry={telemetry} mock={import.meta.env.VITE_ARCADE_MOCK !== 'false'} scene={scene} onSceneChange={setScene} />
    </div>
  )
}

export default App
