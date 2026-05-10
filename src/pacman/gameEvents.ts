/**
 * All event payloads mapped by event name.
 * Uses void when no payload is needed.
 */
export interface EventPayloads {
  // ================================================
  // GAME LIFECYCLE COMMANDS (Director listens)
  // ================================================
  "game:load": void;
  "game:start": void;
  "game:restart": void;
  "game:pause": void;
  "game:resume": void;

  // ================================================
  // GAME LIFECYCLE EVENTS (Broadcast)
  // ================================================
  "game:started": void;
  "game:over": { finalScore: number; level: number };
  "game:resumed": void;

  // ================================================
  // GAME SYSTEM COMMANDS
  // ================================================
  "command:create_entities": void;
  "command:reset_all": void;
  "command:spawn_entities": void;
  "command:reset_positions": void;
  "command:exit_lair_all": void;
  "command:init_all": void;
  "command:clear_canvases": void;
  "command:setup_environment": void;

  // ================================================
  // LEVEL LIFECYCLE
  // ================================================
  "level:start": { level: number; totalDots: number };
  "level:complete": { level: number; score: number };
  "level:intermission_start": { nextLevel: number };
  "level:transition_start": { duration: number };
  "level:transition_end": void;

  // ================================================
  // ENTITY INTERACTIONS
  // ================================================
  "dot:collect": { position: { i: number; j: number } };
  "power_pill:collect": { position: { i: number; j: number } };
  "ghost:collect": { ghostName: string; ghostIndex: number };

  // ================================================
  // ENTITY: PACMAN
  // ================================================
  "pacman:death_triggered": void;
  "pacman:death_animation_start": { x: number; y: number };
  "pacman:death_animation_end": void;
  "pacman:direction_changed": {
    direction: { dx: number; dy: number };
  };
  "pacman:respawn": void;

  // ================================================
  // ENTITY: GHOSTS
  // ================================================
  "ghost:eaten": {
    ghostName: string;
    points: number;
    ghostIndex: number;
  };
  "ghost:returned_home": { ghostName: string };
  "ghost:state_changed": {
    ghostName: string;
    from: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN";
    to: "CHASE" | "SCATTER" | "FRIGHTENED" | "EATEN";
  };
  "command:ghost_eaten": { ghostName: string };

  // ================================================
  // ENTITY: POWER PILLS
  // ================================================
  "power_pill:eaten": { position: { i: number; j: number } };
  "power_pill:activated": { duration: number };
  "power_pill:warning": { remainingSeconds: number };
  "power_pill:expired": void;

  // ================================================
  // ENTITY: DOTS
  // ================================================
  "dot:eaten": { position: { i: number; j: number }; dotsRemaining: number };

  // ================================================
  // SCORING
  // ================================================
  "score:updated": { score: number; delta: number; reason: string };
  "lives:changed": { lives: number; delta: number; reason: string };
  "bonus_life:earned": { newTotal: number; threshold: number };

  // ================================================
  // AUDIO
  // ================================================
  "audio:sfx_play": { name: string };
  "audio:music_play": { name: string; loop: boolean };
  "audio:music_stop": void;
  "audio:mute_toggle": void;
  "audio:mute_changed": { isMuted: boolean };

  // ================================================
  // UI/RENDER
  // ================================================
  "ui:ready_prompt_show": void;
  "ui:game_over_show": { score: number; level: number };
  "ui:level_display_update": { level: number };
  "ui:score_display_update": { score: number };
  "ui:lives_display_update": { lives: number };
}

/**
 * All valid game event names.
 */
export type GameEvent = keyof EventPayloads;
