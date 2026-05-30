export type GameMode =
  | "INIT"                // Initial state, waiting for player to start
  | "PLAYING"             // Normal gamepaly
  | "PAUSED"              // Pause/freeze
  | "PACMAN_DEAD"         // Death animation playing, game frozen
  | "GHOST_EATEN"         // Ghost eaten freeze frame
  | "LEVEL_TRANSITION"    // Countdown before level starts
  | "LEVEL_COMPLETE"      // All dots eaten, maze flashing
  | "INTERMISSION"        // Between levels, showing intermission screen
  | "GAME_OVER";  