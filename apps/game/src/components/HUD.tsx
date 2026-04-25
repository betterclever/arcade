import { useMemo, useState } from 'react'
import { ArcadeSDK, Bid } from '@arcade/sdk'
import { DrivingTelemetry } from './Car'
import { DriveInputKey, setDriveInput } from '../utils/input'
import { SceneId } from './RoadAndEnvironment'

interface HUDProps {
  bids: Bid[]
  sdk: ArcadeSDK
  telemetry: DrivingTelemetry
  mock: boolean
  scene: SceneId
  onSceneChange: (scene: SceneId) => void
}

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(3)}`
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

const sceneOptions: SceneId[] = ['meadow', 'alpine', 'desert', 'dusk']

export default function HUD({ bids, sdk, telemetry, mock, scene, onSceneChange }: HUDProps) {
  const currentWinner = bids[0]
  const [status, setStatus] = useState('ready')
  const [error, setError] = useState<string | null>(null)
  const nextBid = useMemo(() => {
    const leader = currentWinner?.amountUsd ?? currentWinner?.amount ?? 0.002
    return Math.min(0.01, Number((leader + 0.001).toFixed(3)))
  }, [currentWinner])

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
      <section className="hud-panel hud-primary">
        <div className="hud-kicker">Arcad(e) live surface</div>
        <div className="winner-row">
          <div>
            <h1>{currentWinner?.company ?? currentWinner?.bidder ?? 'Open Road Auction'}</h1>
            <p>{currentWinner?.prompt ?? 'Billboards update as bids and rendered ads arrive from the SDK.'}</p>
          </div>
          <div className="winner-bid">{currentWinner ? money(currentWinner.amountUsd ?? currentWinner.amount) : 'idle'}</div>
        </div>
        <div className="meter-grid">
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
      </section>

      <section className="hud-panel hud-actions">
        <div className="control-grid" aria-label="Driving controls">
          <ControlButton label="W" inputKey="accelerate" />
          <div className="steer-pair">
            <ControlButton label="A" inputKey="steerLeft" />
            <ControlButton label="D" inputKey="steerRight" />
          </div>
          <ControlButton label="S" inputKey="brake" />
        </div>
        <div className="action-stack">
          <button className="hud-button primary" onClick={placeBid} type="button">Bid {money(nextBid)}</button>
          <button className="hud-button" onClick={closeRound} type="button">Close Round + Render</button>
          <div className="hud-status">{status}</div>
          {error && <div className="hud-error">{error}</div>}
        </div>
      </section>

      <section className="hud-panel bid-strip">
        <div className="strip-head">
          <span>Live bids</span>
          <span>{bids.length} total</span>
        </div>
        <div className="bid-list">
          {bids.slice(0, 5).map((bid) => (
            <div className="bid-row" key={bid.id}>
              <span>{bid.company ?? bid.bidder}</span>
              <strong>{money(bid.amountUsd ?? bid.amount)}</strong>
            </div>
          ))}
          {bids.length === 0 && <div className="empty-row">waiting for agents</div>}
        </div>
        <div className="receipt-row">
          {bids.slice(0, 4).map((bid, index) => (
            <div className="receipt" key={bid.id} title={JSON.stringify(bid.paymentReceipt ?? bid.status ?? 'pending')}>
              <span>R{index + 1}</span>
              <strong>{bid.status ?? (bid.paymentReceipt ? 'paid' : 'queued')}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
