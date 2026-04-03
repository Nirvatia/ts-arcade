// Define this in a separate config file, e.g., src/lib/config/assets/pacman/sfx.ts
const AUDIO_CONFIG = [
  // Core Gameplay
  { name: "start", url: "/assets/pacman/sfx/start.wav" },
  { name: "waka_0", url: "/assets/pacman/sfx/eat_dot_0.wav" },
  { name: "waka_1", url: "/assets/pacman/sfx/eat_dot_1.wav" },
  { name: "death", url: "/assets/pacman/sfx/death_0.wav" },
  { name: "eat_ghost", url: "/assets/pacman/sfx/eat_ghost.wav" },
  { name: "fruit", url: "/assets/pacman/sfx/eat_fruit.wav" },

  // Looping Environment 
  { name: "siren_0", url: "/assets/pacman/sfx/siren0.wav" },
  { name: "siren_1", url: "/assets/pacman/sfx/siren1.wav" },
  { name: "siren_2", url: "/assets/pacman/sfx/siren2.wav" },
  { name: "fright", url: "/assets/pacman/sfx/fright.wav" },
  { name: "retreat", url: "/assets/pacman/sfx/eyes.wav" },

  // UI / Menus
  { name: "credit", url: "/assets/pacman/sfx/credit.wav" },
];

export { AUDIO_CONFIG };