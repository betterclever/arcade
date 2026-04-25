export const driveInput = {
  accelerate: false,
  brake: false,
  steerLeft: false,
  steerRight: false,
}

export type DriveInputKey = keyof typeof driveInput

export function setDriveInput(key: DriveInputKey, value: boolean) {
  driveInput[key] = value
}
