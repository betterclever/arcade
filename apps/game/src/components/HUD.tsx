import { useEffect, useMemo, useState } from 'react'
import { Bid, SurfaceSnapshot } from '@arcade/sdk'
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

function formatDuration(ms: number) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function activityTime(bid: Bid) {
  return bid.updatedAt ?? bid.timestamp
}

function roundTitle(roundId: string, snapshot: SurfaceSnapshot | null, index: number) {
  if (snapshot?.round?.id === roundId) return 'Current round'
  if (snapshot?.lastClosedRound?.id === roundId) return 'Last closed round'
  return `Round ${index + 1}`
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

export default function HUD({ bids, bidHistory, activeWinner, snapshot, textureUrl, telemetry, mock, scene, car, onSceneChange, onCarChange, onHide }: HUDProps) {
  const liveLeader = bids[0]
  const displayWinner = activeWinner ?? liveLeader
  const [now, setNow] = useState(Date.now())
  const roundMsRemaining = snapshot?.round?.endsAt ? snapshot.round.endsAt - now : 0
  const timelineRounds = useMemo(() => {
    const byId = new Map<string, Bid>()
    ;[...bidHistory, ...bids].forEach((bid) => byId.set(bid.id, bid))
    const grouped = [...byId.values()].reduce<Map<string, Bid[]>>((acc, bid) => {
      const roundId = bid.roundId ?? 'unknown'
      acc.set(roundId, [...(acc.get(roundId) ?? []), bid])
      return acc
    }, new Map())

    if (snapshot?.round?.id && !grouped.has(snapshot.round.id)) {
      grouped.set(snapshot.round.id, [])
    }

    return [...grouped.entries()]
      .map(([roundId, roundBids]) => ({
        roundId,
        round: snapshot?.rounds?.find((candidate) => candidate.id === roundId) ?? (snapshot?.round?.id === roundId ? snapshot.round : undefined),
        bids: roundBids.sort((a, b) => activityTime(b) - activityTime(a)),
        lastActivity: roundBids.length > 0 ? Math.max(...roundBids.map(activityTime)) : snapshot?.round?.startsAt ?? 0,
      }))
      .sort((a, b) => {
        const aOpen = a.roundId === snapshot?.round?.id ? 1 : 0
        const bOpen = b.roundId === snapshot?.round?.id ? 1 : 0
        return bOpen - aOpen || b.lastActivity - a.lastActivity
      })
      .slice(0, 3)
  }, [bidHistory, bids, snapshot])
  const currentRoundBids = bids.length
  const lastRenderedAt = snapshot?.lastClosedRound?.endsAt ?? activeWinner?.updatedAt ?? activeWinner?.timestamp

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

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

      <section className="hud-panel round-panel">
        <div className="action-head">
          <span>round stats</span>
          <strong>{snapshot?.round?.status ?? 'syncing'}</strong>
        </div>
        <div className="round-timer">
          <span>time left</span>
          <strong>{snapshot?.round?.status === 'open' ? formatDuration(roundMsRemaining) : '--:--'}</strong>
        </div>
        <div className="round-stat-grid">
          <div>
            <span>current bids</span>
            <strong>{currentRoundBids}</strong>
          </div>
          <div>
            <span>leader</span>
            <strong>{liveLeader ? `${liveLeader.company ?? liveLeader.bidder} ${money(liveLeader.amountUsd ?? liveLeader.amount)}` : 'none'}</strong>
          </div>
          <div>
            <span>last winner</span>
            <strong>{activeWinner ? `${activeWinner.company ?? activeWinner.bidder} ${money(activeWinner.amountUsd ?? activeWinner.amount)}` : 'none'}</strong>
          </div>
          <div>
            <span>last render</span>
            <strong>{lastRenderedAt ? timeLabel(lastRenderedAt) : 'pending'}</strong>
          </div>
        </div>
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
          <span>Bids by round</span>
          <span>{timelineRounds.length} rounds</span>
        </div>
        <div className="round-list">
          {timelineRounds.map((roundGroup, roundIndex) => (
            <div className="round-group" key={roundGroup.roundId}>
              <div className="round-group-head">
                <span>{roundTitle(roundGroup.roundId, snapshot, roundIndex)}</span>
                <strong>{roundGroup.round?.status ?? 'history'}</strong>
              </div>
              <div className="timeline-list">
                {roundGroup.bids.slice(0, 4).map((bid, index) => (
                  <div className={index === 0 ? 'timeline-row latest' : 'timeline-row'} key={bid.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-copy">
                      <strong>{bid.company ?? bid.bidder}</strong>
                      <span>{bid.status ?? 'bid'} · {timeLabel(activityTime(bid))}</span>
                    </div>
                    <div className="timeline-amount">{money(bid.amountUsd ?? bid.amount)}</div>
                  </div>
                ))}
                {roundGroup.bids.length === 0 && <div className="empty-row">no bids yet</div>}
              </div>
            </div>
          ))}
          {timelineRounds.length === 0 && <div className="empty-row">waiting for agents</div>}
        </div>
      </section>
    </div>
  )
}
