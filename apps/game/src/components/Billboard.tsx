import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Bid } from '@arcade/sdk'

interface BillboardProps {
  position: [number, number, number]
  rotation: [number, number, number]
  textureUrl: string
  winner?: Bid
  scale?: number
}

function makeFallbackTexture(winner?: Bid) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const brand = winner?.company ?? winner?.bidder ?? 'Arcad(e)'
  const amount = winner ? `$${Number(winner.amountUsd ?? winner.amount).toFixed(3)}` : 'LIVE BID'

  const gradient = ctx.createLinearGradient(0, 0, 1024, 512)
  gradient.addColorStop(0, '#143536')
  gradient.addColorStop(0.58, '#e7a84d')
  gradient.addColorStop(1, '#f4ead4')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)

  ctx.fillStyle = 'rgba(17, 26, 28, 0.46)'
  ctx.fillRect(0, 0, 1024, 512)
  ctx.fillStyle = '#f8f1de'
  ctx.font = '700 92px system-ui, sans-serif'
  ctx.fillText(brand.slice(0, 18), 70, 180)
  ctx.font = '600 42px system-ui, sans-serif'
  ctx.fillText('agent-bid dynamic ad', 74, 252)
  ctx.font = '700 76px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(amount, 72, 385)
  ctx.strokeStyle = 'rgba(248, 241, 222, 0.76)'
  ctx.lineWidth = 12
  ctx.strokeRect(28, 28, 968, 456)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export default function Billboard({ position, rotation, textureUrl, winner, scale = 1 }: BillboardProps) {
  const [adTexture, setAdTexture] = useState<THREE.Texture>(() => makeFallbackTexture(winner))

  useEffect(() => {
    let cancelled = false
    const fallback = makeFallbackTexture(winner)

    if (!textureUrl) {
      setAdTexture(fallback)
      return () => fallback.dispose()
    }

    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      textureUrl,
      (texture) => {
        if (cancelled) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = 8
        setAdTexture((previous) => {
          previous.dispose()
          return texture
        })
        fallback.dispose()
      },
      undefined,
      () => {
        if (!cancelled) {
          setAdTexture((previous) => {
            previous.dispose()
            return fallback
          })
        }
      },
    )

    return () => {
      cancelled = true
    }
  }, [textureUrl, winner])

  const frameMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#162023', roughness: 0.52, metalness: 0.62 }), [])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 5.35, 0]}>
        <boxGeometry args={[18.4, 8.8, 0.58]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 5.35, 0.34]}>
        <planeGeometry args={[17.35, 7.72]} />
        <meshStandardMaterial map={adTexture} roughness={0.48} metalness={0.02} emissive="#ffffff" emissiveIntensity={0.16} side={THREE.DoubleSide} />
      </mesh>
      <mesh castShadow receiveShadow position={[-6.2, 0.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 9.2, 14]} />
        <meshStandardMaterial color="#364144" roughness={0.68} metalness={0.5} />
      </mesh>
      <mesh castShadow receiveShadow position={[6.2, 0.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 9.2, 14]} />
        <meshStandardMaterial color="#364144" roughness={0.68} metalness={0.5} />
      </mesh>
      <mesh position={[0, 9.95, -0.26]}>
        <boxGeometry args={[18.9, 0.22, 0.84]} />
        <meshStandardMaterial color="#f0bd62" roughness={0.38} metalness={0.12} />
      </mesh>
    </group>
  )
}
