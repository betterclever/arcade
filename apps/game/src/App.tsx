import { useState, useEffect, useMemo } from 'react'
import { ArcadeSDK, Bid, SurfaceSnapshot } from '@arcade/sdk'
import GameScene from './components/GameScene'
import HUD from './components/HUD'
import { DrivingTelemetry } from './components/Car'
import { SceneId } from './components/RoadAndEnvironment'
import { CarId } from './data/cars'
import './App.css'

function App() {
  const sdk = useMemo(() => new ArcadeSDK({
    mock: import.meta.env.VITE_ARCADE_MOCK !== 'false',
    baseUrl: import.meta.env.VITE_ARCADE_API_URL ?? 'http://localhost:8787/api',
    surfaceId: import.meta.env.VITE_ARCADE_SURFACE_ID ?? 'raceway-billboard-main',
  }), [])
  const [bids, setBids] = useState<Bid[]>([])
  const [bidHistory, setBidHistory] = useState<Bid[]>([])
  const [lastWinner, setLastWinner] = useState<Bid | null>(null)
  const [surfaceSnapshot, setSurfaceSnapshot] = useState<SurfaceSnapshot | null>(null)
  const [textureUrl, setTextureUrl] = useState<string>('https://picsum.photos/seed/arcade-open-road/1024/512')
  const [telemetry, setTelemetry] = useState<DrivingTelemetry>({ speed: 0, steering: 0 })
  const [scene, setScene] = useState<SceneId>('meadow')
  const [car, setCar] = useState<CarId>('sedan')
  const [playing, setPlaying] = useState(false)
  const [hudVisible, setHudVisible] = useState(true)

  useEffect(() => {
    const unsubBids = sdk.subscribeToBids(setBids)
    const unsubBidHistory = sdk.subscribeToBidHistory(setBidHistory)
    const unsubLastWinner = sdk.subscribeToLastWinner(setLastWinner)
    const unsubSnapshot = sdk.subscribeToSurfaceSnapshot(setSurfaceSnapshot)
    const unsubTexture = sdk.subscribeToTextureUpdates(setTextureUrl)

    return () => {
      unsubBids()
      unsubBidHistory()
      unsubLastWinner()
      unsubSnapshot()
      unsubTexture()
      sdk.stop()
    }
  }, [sdk])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!playing) {
        setPlaying(true)
        setHudVisible(true)
        return
      }

      if (event.code === 'KeyH') {
        setHudVisible((visible) => !visible)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playing])

  return (
    <div className="arcade-shell">
      <GameScene textureUrl={textureUrl} winner={lastWinner ?? bids[0]} scene={scene} car={car} playing={playing} onTelemetry={setTelemetry} />

      {!playing && (
        <button className="start-overlay" type="button" onClick={() => setPlaying(true)}>
          <span className="start-kicker">Arcad(e) live ad surface</span>
          <strong>arcad drive</strong>
          <span className="start-prompt">press any key to start playing</span>
        </button>
      )}

      {playing && hudVisible && (
        <HUD
          bids={bids}
          bidHistory={bidHistory}
          activeWinner={lastWinner}
          snapshot={surfaceSnapshot}
          textureUrl={textureUrl}
          sdk={sdk}
          telemetry={telemetry}
          mock={import.meta.env.VITE_ARCADE_MOCK !== 'false'}
          scene={scene}
          car={car}
          onSceneChange={setScene}
          onCarChange={setCar}
          onHide={() => setHudVisible(false)}
        />
      )}

      {playing && !hudVisible && (
        <div className="hud-hidden-chip">H show UI</div>
      )}
    </div>
  )
}

export default App
