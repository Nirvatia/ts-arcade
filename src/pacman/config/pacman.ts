// config/pacman.ts

export interface PacmanConfig {
  normalSpeedMultiplier: number;
  buffedSpeedMultiplier: number;
  deathAnimationDuration: number;
  radiusMultiplier: number;
  mouthSpeed: number;
  maxMouthAngle: number;
  idleMouthAngle: number;
  axisAlignSpeed: number;
  turnThreshold: number;
  colors: {
    normal: {
      body: string;
      stroke: string;
      glow: string;
    };
    buffed: {
      body: string;
      stroke: string;
      glow: string;
    };
  };
}

export const CFG_PACMAN: PacmanConfig = {
  // Bounded up from 4.8 for high-response kinetic movement
  normalSpeedMultiplier: 5.8,
  // Aggressive speed step-up when power-pilled
  buffedSpeedMultiplier: 6.6,
  deathAnimationDuration: 3,
  radiusMultiplier: 0.55,
  mouthSpeed: 0.015,
  maxMouthAngle: Math.PI / 2.8,
  idleMouthAngle: Math.PI / 4,
  axisAlignSpeed: 0.3,
  turnThreshold: 0.5,
  colors: {
    normal: {
      body: "#e6c800",
      stroke: "#b8a000",
      glow: "#e6c800",
    },
    buffed: {
      body: "#00c8d4",
      stroke: "#008a94",
      glow: "#00c8d4",
    },
  },
};