import { useMemo, useState } from 'react'
import { ArcadeSDK, Bid, SurfaceSnapshot } from '@arcade/sdk'
import { DrivingTelemetry } from './Car'
import { DriveInputKey, setDriveInput } from '../utils/input'
import { SceneId } from './RoadAndEnvironment'
import { CarId, carOptions } from '../data/cars'

interface HUDProps {
  bids: Bid[]
  bidHistory: Bid[]
  activeWinner: Bid | null
  snapshot: SurfaceSnapshot | null
  textureUrl: string
  sdk: ArcadeSDK
  telemetry: DrivingTelemetry
  mock: boolean
  scene: SceneId
  car: CarId
  onSceneChange: (scene: SceneId) => void
  onCarChange: (car: CarId) => void
  onHide: () => void
}

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(3)}`
}

function timeLabel(timestamp?: number) {
  if (!timestamp) return 'now'
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function ControlButton({ label, inputKey }: { label: string, inputKey: DriveInputKey }) {
  return (
    <button
      className="control-button"
      onPointerDown={() => setDriveInput(inputKey, true)}
      onPointerUp={() => setDriveInput(inputKey, false)}
      onPointerCancel={() => setDriveInput(inputKey, false)}
      onPointerLeave={() => setDriveInput(inputKey, false)}
      type="button"
    >
      {label}
    </button>
  )
}

const sceneOptions: SceneId[] = ['meadow', 'alpine', 'snow', 'autumn', 'coast', 'desert', 'dusk']

export default function HUD({ bids, bidHistory, activeWinner, textureUrl, sdk, telemetry, mock, scene, car, onSceneChange, onCarChange, onHide }: HUDProps) {
  const liveLeader = bids[0]
  const displayWinner = activeWinner ?? liveLeader
  const timeline = useMemo(() => {
    const byId = new Map<string, Bid>()
    ;[...bidHistory, ...bids].forEach((bid) => byId.set(bid.id, bid))
    return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8)
  }, [bidHistory, bids])
  const [status, setStatus] = useState('ready')
  const [error, setError] = useState<string | null>(null)
  const nextBid = useMemo(() => {
    const leader = liveLeader?.amountUsd ?? liveLeader?.amount ?? 0.002
    return Math.min(0.01, Number((leader + 0.001).toFixed(3)))
  }, [liveLeader])

  async function placeBid() {
    setError(null)
    setStatus('submitting bid')
    try {
      await sdk.submitBid({
        amount: nextBid,
        amountUsd: nextBid,
        bidder: 'Arcade Driver',
        company: 'Switchback Coffee',
        prompt: 'A crisp mountain road billboard for Switchback Coffee, readable cream lettering, copper thermos, dawn light',
        rationale: 'Player-triggered bid from the live driving demo.',
      })
      setStatus('bid accepted')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bid failed')
      setStatus('mock fallback available')
    }
  }

  async function closeRound() {
    setError(null)
    setStatus('closing round')
    try {
      const result = await sdk.closeRound()
      setStatus(result ? 'render requested' : 'mock render simulated')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Close round failed')
      setStatus('close failed')
    }
  }

  return (
    <div className="hud">
      <section className="hud-panel campaign-panel">
        <div className="campaign-topline">
          <span>arcad drive</span>
          <button className="ghost-button" onClick={onHide} type="button">H hide</button>
        </div>
        <div className="campaign-card">
          <div className="campaign-label">{activeWinner ? 'on billboard now' : 'waiting for first render'}</div>
          <div className="campaign-row">
            <div className="campaign-copy">
              <h1>{displayWinner?.company ?? displayWinner?.bidder ?? 'Open Road Auction'}</h1>
              <p>{displayWinner?.prompt ?? 'Close a round to render the winning campaign onto every roadside billboard.'}</p>
            </div>
            <div className="campaign-price">{displayWinner ? money(displayWinner.amountUsd ?? displayWinner.amount) : 'idle'}</div>
          </div>
          <div className="render-preview">
            <img src={textureUrl} alt="" />
            <div>
              <span>render source</span>
              <strong>{activeWinner ? 'last winning image' : 'live surface fallback'}</strong>
            </div>
          </div>
        </div>
        <div className="metric-strip">
          <div>
            <span>Speed</span>
            <strong>{Math.round(telemetry.speed * 1.7)} mph</strong>
          </div>
          <div>
            <span>Steer</span>
            <strong>{telemetry.steering > 0.08 ? 'right' : telemetry.steering < -0.08 ? 'left' : 'center'}</strong>
          </div>
          <div>
            <span>Mode</span>
            <strong>{mock ? 'mock' : 'live api'}</strong>
          </div>
        </div>
        <div className="leader-strip">
          <span>live leader</span>
          <strong>{liveLeader ? `${liveLeader.company ?? liveLeader.bidder} ${money(liveLeader.amountUsd ?? liveLeader.amount)}` : 'waiting for bids'}</strong>
        </div>
      </section>

      <section className="hud-panel action-panel">
        <div className="action-head">
          <span>auction controls</span>
          <strong>{status}</strong>
        </div>
        <div className="action-stack">
          <button className="hud-button primary" onClick={placeBid} type="button">Bid {money(nextBid)}</button>
          <button className="hud-button" onClick={closeRound} type="button">Close Round + Render</button>
        </div>
        {error && <div className="hud-error">{error}</div>}
      </section>

      <section className="hud-panel drive-panel">
        <div className="drive-panel-head">
          <span>drive</span>
          <strong>WASD / arrows</strong>
        </div>
        <div className="control-grid" aria-label="Driving controls">
          <ControlButton label="W" inputKey="accelerate" />
          <div className="steer-pair">
            <ControlButton label="A" inputKey="steerLeft" />
            <ControlButton label="D" inputKey="steerRight" />
          </div>
          <ControlButton label="S" inputKey="brake" />
        </div>
      </section>

      <section className="hud-panel scene-panel">
        <div className="scene-head">
          <span>scene</span>
          <strong>{scene}</strong>
        </div>
        <div className="scene-tabs" aria-label="Scene">
          {sceneOptions.map((option) => (
            <button
              key={option}
              className={option === scene ? 'scene-tab active' : 'scene-tab'}
              onClick={() => onSceneChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <div className="car-tabs" aria-label="Car">
          {carOptions.map((option) => (
            <button
              key={option.id}
              className={option.id === car ? 'car-tab active' : 'car-tab'}
              onClick={() => onCarChange(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="hud-panel bid-panel">
        <div className="strip-head">
          <span>Bid timeline</span>
          <span>{timeline.length} shown</span>
        </div>
        <div className="timeline-list">
          {timeline.map((bid, index) => (
            <div className={index === 0 ? 'timeline-row latest' : 'timeline-row'} key={bid.id}>
              <div className="timeline-dot" />
              <div className="timeline-copy">
                <strong>{bid.company ?? bid.bidder}</strong>
                <span>{bid.status ?? 'bid'} · {timeLabel(bid.timestamp)}</span>
              </div>
              <div className="timeline-amount">{money(bid.amountUsd ?? bid.amount)}</div>
            </div>
          ))}
          {timeline.length === 0 && <div className="empty-row">waiting for agents</div>}
        </div>
      </section>
    </div>
  )
}
