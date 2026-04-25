import * as THREE from 'three'

interface BillboardProps {
  position: [number, number, number]
  rotation: [number, number, number]
  texture: THREE.Texture
  scale?: number
}

const frameMaterial = new THREE.MeshStandardMaterial({ color: '#162023', roughness: 0.56, metalness: 0.42 })
const postMaterial = new THREE.MeshStandardMaterial({ color: '#364144', roughness: 0.72, metalness: 0.38 })
const capMaterial = new THREE.MeshStandardMaterial({ color: '#f0bd62', roughness: 0.42, metalness: 0.08 })

export function makeBillboardTexture(label = 'Arcad', sublabel = 'agent-bid dynamic ad', amount = 'LIVE BID') {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 384
  const ctx = canvas.getContext('2d')!

  const gradient = ctx.createLinearGradient(0, 0, 768, 384)
  gradient.addColorStop(0, '#163434')
  gradient.addColorStop(0.58, '#dca24f')
  gradient.addColorStop(1, '#efe0bd')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 768, 384)

  ctx.fillStyle = 'rgba(19, 27, 29, 0.48)'
  ctx.fillRect(0, 0, 768, 384)
  ctx.fillStyle = '#f7eed8'
  ctx.font = '700 68px system-ui, sans-serif'
  ctx.fillText(label.slice(0, 18), 48, 134)
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText(sublabel.slice(0, 32), 52, 198)
  ctx.font = '700 54px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.fillText(amount, 52, 292)
  ctx.strokeStyle = 'rgba(247, 238, 216, 0.72)'
  ctx.lineWidth = 8
  ctx.strokeRect(22, 22, 724, 340)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 2
  return texture
}

export default function Billboard({ position, rotation, texture, scale = 1 }: BillboardProps) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 5.35, 0]}>
        <boxGeometry args={[18.4, 8.8, 0.58]} />
        <primitive object={frameMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 5.35, 0.34]}>
        <planeGeometry args={[17.35, 7.72]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-6.2, 0.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 9.2, 10]} />
        <primitive object={postMaterial} attach="material" />
      </mesh>
      <mesh position={[6.2, 0.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 9.2, 10]} />
        <primitive object={postMaterial} attach="material" />
      </mesh>
      <mesh position={[0, 9.95, -0.26]}>
        <boxGeometry args={[18.9, 0.22, 0.84]} />
        <primitive object={capMaterial} attach="material" />
      </mesh>
    </group>
  )
}
