export interface EventPayloads {
  // GAME FLOW COMMANDS (Fired by UI buttons/Inputs directly to the Director)
  "game:load": void;
  "game:start": void;
  "game:restart": void;
  "game:pause": void;
  "game:resume": void;

  // SYSTEM STATE NOTIFICATIONS
  "game:over": { finalScore: number; level: number };
  "level:countdown_start": void;
  "level:start": { level: number; totalDots: number };
  "level:complete": { level: number; score: number };
  "level:intermission_start": { nextLevel: number };

  // CORE ACTIONS (Dumb-fire signals from actors)
  "dot:collect": { position: { i: number; j: number } };
  "power_pill:collect": { position: { i: number; j: number } };
  "ghost:collect": { ghostName: string; ghostIndex: number };

  // ANNOUNCEMENTS FOR SFX & TALLY MUTATIONS
  "pacman:death_animation_start": void;
  "pacman:death_animation_end": void;

  "dot:eaten": { position: { i: number; j: number }; dotsRemaining: number };
  "dot:spawned": { count: number };

  "power_pill:eaten": { position: { i: number; j: number } };
  "power_pill:activated": { duration: number };
  "power_pill:warning": { remainingSeconds: number };
  "power_pill:expired": void;

  "ghost:eaten": { ghostName: string; points: number; ghostIndex: number };
  "ghost:returned_home": { ghostName: string };
  "ghost:state_changed": { ghostName: string; from: string; to: string };

  "score:updated": { score: number; delta: number; reason: string };
  "bonus_life:acquired": { lives: number };

  // AUDIO & PURE UI RENDERING DRIVERS
  "audio:sfx_play": { name: string };
  "audio:music_play": { name: string; loop: boolean };
  "audio:music_stop": void;

  "ui:game_over_show": { score: number; level: number };
  "ui:level_display_update": { level: number };
  "ui:score_display_update": { score: number };
  "ui:lives_display_update": { lives: number };
}

export type GameEvent = keyof EventPayloads;
