// config/pixiGrid.config.ts
export const CFG_PIXI_GRID = {
  deathDuration: 3.5,

  // Flash
  flashDuration: 0.3,
  flashMaxRadius: 80,

  // Lens
  lensMaxRadius: 160,
  lensStrength: 8,

  // Block pull
  blockPullStrength: 3.5,
  blockPullMaxDist: 300,
  blockStaggerBase: 21,
  blockStaggerDelay: 0.022,
  stretchMax: 3.5,            // max elongation ratio
  snapThreshold: 0.5,         // progress where stretched blocks rupture

  // Debris
  debrisCountPerBlock: 3,
  debrisSpeed: 140,
  debrisLife: 0.7,

  // Particles
  particleCount: 90,
  particleRadiusMin: 10,
  particleRadiusMax: 220,
  particleSpeedMin: 0.5,
  particleSpeedMax: 4.5,
  particleRadiusDecay: 45,
  particleAngleSpeed: 1.4,
  particleAngleCollapse: 4.5,

  // Singularity
  singularityAppearAt: 0.4,
  singularityMaxRadius: 35,
  haloMaxRadius: 70,
  haloFlickerSpeed: 12,

  // Floor stars
  starRecoverySpeed: 1.8,
};