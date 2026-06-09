// config/pacman.config.ts
export interface PacmanConfig {
  normalSpeedMultiplier: number;
  buffedSpeedMultiplier: number;
  radiusMultiplier: number;
  mouthSpeed: number;
  maxMouthAngle: number;
  idleMouthAngle: number;
  axisAlignSpeed: number;
  turnThreshold: number;
}

export const CFG_PACMAN: PacmanConfig = {
  normalSpeedMultiplier: 5,
  buffedSpeedMultiplier: 5.4,
  radiusMultiplier: 0.45,
  mouthSpeed: 0.012,
  maxMouthAngle: 0.65,
  idleMouthAngle: 0.25,
  axisAlignSpeed: 8,
  turnThreshold: 0.45,
};