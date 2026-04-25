export type CarId = 'sedan' | 'suv'

export interface CarOption {
  id: CarId
  label: string
  modelUrl: string
  maxSpeed: number
  cruiseSpeed: number
  acceleration: number
  braking: number
  handling: number
  cameraLift: number
  paint: string
  glass: string
}

export const carOptions: CarOption[] = [
  {
    id: 'sedan',
    label: 'Sedan',
    modelUrl: '/assets/cars/sedan.glb',
    maxSpeed: 132,
    cruiseSpeed: 42,
    acceleration: 54,
    braking: 60,
    handling: 1.02,
    cameraLift: 0.08,
    paint: '#2f72d0',
    glass: '#9fd7e4',
  },
  {
    id: 'suv',
    label: 'SUV',
    modelUrl: '/assets/cars/suv.glb',
    maxSpeed: 122,
    cruiseSpeed: 38,
    acceleration: 48,
    braking: 56,
    handling: 0.9,
    cameraLift: 0.32,
    paint: '#e05f34',
    glass: '#b7e0e2',
  },
]

export function getCarOption(id: CarId) {
  return carOptions.find((car) => car.id === id) ?? carOptions[0]
}
