/**
 * Represents the global state machine phases of the Pac-Man game engine.
 * Governs the orchestrator loop execution, input parsing, and rendering contexts.
 */
export type GameMode =
  /** Initial application boot state; menu initialization, awaiting user input to start */
  | "INIT"
  /** Core active gameplay loop; physics processing, input capture, and actor navigation are fully active */
  | "PLAYING"
  /** Execution freeze state; halts update ticks across actors while maintaining the render layer view */
  | "PAUSED"
  /** Player loss sequence; suspends global updates to isolate and process Pac-Man's death animation timeline */
  | "PACMAN_DEAD"
  /** Hitbox contact freeze frame; momentary engine logic pause to display score point rewards upon consuming a ghost */
  | "GHOST_EATEN"
  /** Level introduction countdown; map display phase prior to actor pathfinding activation ("Ready!" prompt) */
  | "LEVEL_TRANSITION"
  /** Win condition met; map cleared of consumables, suspends entity logic to execute vector maze wall flashing animations */
  | "LEVEL_COMPLETE"
  /** Non-gameplay narrative cinematic; active game variables are cached while a scripted intermission scene renders */
  | "INTERMISSION"
  /** Terminal execution state; player lives depleted, displays high score tallies and game over UI overlays */
  | "GAME_OVER";
