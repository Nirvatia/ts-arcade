// director/Director.svelte.ts
import { Clock } from "../core/Clock.svelte.js";
import { eventBus } from "../core/EventBus.js";
import { Sequence } from "../core/Sequence.js";
import type { GameRegistry } from "./GameRegistry.js";
import type { GameState } from "./GameState.svelte.js";
import type { Tally } from "./Tally.svelte.js";
import type { Renderer } from "../render/Renderer.js";
import type { GameLoop } from "../core/GameLoop.js";
import { CFG_PIXI_GRID } from "../config/pixiGrid.config.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import type { TypeDeathScene } from "../shared/types.js";

const COUNTDOWN_SECONDS = 5;
const INTERMISSION_SECONDS = 10;

export class Director {
  private readonly gameState: GameState;
  private readonly gameRegistry: GameRegistry;
  private readonly tally: Tally;
  private readonly gameLoop: GameLoop;
  private readonly renderer: Renderer;

  private clock = $state<{ current: Clock | null }>({ current: null });
  private readonly sequence = new Sequence();

  constructor(
    gameState: GameState,
    gameRegistry: GameRegistry,
    tally: Tally,
    gameLoop: GameLoop,
    renderer: Renderer,
  ) {
    this.gameState = gameState;
    this.gameRegistry = gameRegistry;
    this.tally = tally;
    this.gameLoop = gameLoop;
    this.renderer = renderer;
    this.wireEvents();
  }

  get currentClock(): Clock | null {
    return this.clock.current;
  }

  private wireEvents(): void {
    eventBus.on("game:start", () => this.beginCountdown());
    eventBus.on("game:restart", () => this.restartGame());
    eventBus.on("level:complete", (p) => this.playLevelCompleteSequence(p));
    eventBus.on("pacman:death", () => this.playDeathSequence());
  }

  private cancelAll(): void {
    if (this.clock.current) {
      this.clock.current.stop();
      this.clock.current = null;
    }
    this.sequence.clear();
  }

  private startClock(name: string): Clock {
    const c = new Clock();
    this.clock.current = c;
    return c;
  }

  private bindLevelToLoop(): void {
    const level = this.gameRegistry.getActiveLevel();
    if (!level) return;
    this.gameLoop.setUpdatables(level.getAllUpdatable());
    this.renderer.setDrawables(level.getAllDrawable());
  }

  private playDeathSequence(): void {
    this.gameState.mode = "PACMAN_DEAD";
    this.cancelAll();

    const level = this.gameRegistry.getActiveLevel();
    const pacman = level?.pacman;
    const grid = level?.pixiGrid;
    if (!grid || !pacman) return;

    // Fix: Force a structural layout pass before geometry extraction to protect high-DPR screens
    this.renderer.render();

    const entityData: TypeDeathScene = {
      pacman: { x: pacman.x, y: pacman.y },
      ghosts: [],
      dots: [],
      pills: [],
    };

    const ghosts = level?.ghosts ?? [];
    for (const g of ghosts) {
      entityData.ghosts.push({
        x: g.x,
        y: g.y,
        color: g.color,
      });
    }

    const ts = CFG_CANVAS.tile.size;
    for (const key of this.gameState.activeDots) {
      const [i, j] = key.split(",").map(Number);
      entityData.dots.push({ x: j * ts + ts / 2, y: i * ts + ts / 2 });
    }
    for (const key of this.gameState.activePills) {
      const [i, j] = key.split(",").map(Number);
      entityData.pills.push({ x: j * ts + ts / 2, y: i * ts + ts / 2 });
    }

    // Clear canvas layouts safely after positions are recorded
    this.renderer.clear();
    grid.startDeathAnimation(pacman.x, pacman.y, entityData);

    const seconds = CFG_PIXI_GRID.deathDuration;
    const clock = this.startClock("death");

    clock.start(
      seconds * 10,
      100,
      (remaining) => {
        const progress = 1 - remaining / (seconds * 10);
        this.gameState.deathProgress = progress;
        grid.setDeathProgress(progress);
      },
      () => {
        grid.endDeathAnimation();
        this.gameState.deathProgress = 0;
        this.handleLifeLost();
      },
    );
  }

  private handleLifeLost(): void {
    this.cancelAll();
    if (this.gameState.lives - 1 < 0) {
      this.endGame();
    } else {
      this.gameState.lives--;
      this.respawnAfterDeath();
    }
  }

  public async loadGame(): Promise<void> {
    await this.gameRegistry.createLevelAsync();
    this.setupLevel();
    this.bindLevelToLoop();
  }

  public beginCountdown(): void {
    this.cancelAll();
    this.gameLoop.start();
    this.gameState.mode = "LEVEL_TRANSITION";

    eventBus.emit("level:countdown_start");

    const clock = this.startClock("countdown");
    clock.start(
      COUNTDOWN_SECONDS,
      1000,
      () => {},
      () => {
        this.gameState.mode = "PLAYING";
        this.gameRegistry.getActiveLevel()?.exitLairAll();
        this.clock.current = null;
        eventBus.emit("game:resume");
      },
    );
  }

  public async restartGame(): Promise<void> {
    this.cancelAll();
    this.gameRegistry.getActiveLevel()?.pixiGrid.destroy();
    this.gameState.reset();
    await this.gameRegistry.createLevelAsync();
    this.setupLevel();
    this.bindLevelToLoop();
    this.beginCountdown();
  }

  private setupLevel(): void {
    const level = this.gameRegistry.getActiveLevel();
    if (!level) return;
    this.gameState.initializeCollectibles(this.gameState.levelData.map);
    level.clearAllCanvases();
    level.spawnAll();
    eventBus.emit("level:start", {
      level: this.gameState.currentLevel,
      totalDots: this.gameState.totalDots,
    });
  }

  private async respawnAfterDeath(): Promise<void> {
    this.cancelAll();
    await this.gameRegistry.recreateEntitiesAsync();

    const level = this.gameRegistry.getActiveLevel();
    if (!level) return;

    level.clearAllCanvases();
    level.spawnAll();
    this.bindLevelToLoop();

    eventBus.emit("level:countdown_start");

    this.gameState.mode = "LEVEL_TRANSITION";
    level.pixiGrid.needsRedraw = true;
    this.renderer.render();

    const clock = this.startClock("respawn");
    clock.start(
      COUNTDOWN_SECONDS,
      1000,
      () => {},
      () => {
        this.gameState.mode = "PLAYING";
        this.gameRegistry.getActiveLevel()?.exitLairAll();
        this.clock.current = null;
      },
    );
  }

  private endGame(): void {
    this.cancelAll();
    this.gameLoop.stop();
    this.gameState.mode = "GAME_OVER";
    eventBus.emit("ui:game_over_show", {
      score: this.tally.score,
      level: this.gameState.currentLevel,
    });
  }

  private async playLevelCompleteSequence(payload: {
    level: number;
    score: number;
  }): Promise<void> {
    this.cancelAll();
    this.gameState.mode = "LEVEL_COMPLETE";
    this.renderer.clear();

    const level = this.gameRegistry.getActiveLevel();
    const grid = level?.pixiGrid;
    if (!grid) return;

    grid.isFlashing = true;
    setTimeout(() => this.startIntermission(payload), 4800);
  }

  private startIntermission(payload: { level: number; score: number }): void {
    const grid = this.gameRegistry.getActiveLevel()?.pixiGrid;
    if (!grid) return;

    eventBus.emit("level:intermission_start", { nextLevel: payload.level + 1 });
    this.renderer.clear();

    grid.playIntermission(INTERMISSION_SECONDS, async () => {
      this.gameState.mode = "LEVEL_TRANSITION";
      const level = this.gameRegistry.getActiveLevel();
      if (level?.pixiGrid) level.pixiGrid.reset();
      await this.gameRegistry.recreateEntitiesAsync();
      this.setupLevel();
      this.bindLevelToLoop();
      this.beginCountdown();
    });
  }
}