// src/core/GameRegistry.ts

import { Ghost } from "../actors/ghost.js";
import { Pacman } from "../actors/pacman.js";
import { CFG_CANVAS } from "../config/canvas.js";
import { CFG_GHOSTS } from "../config/ghosts.js";
import { CFG_PACMAN } from "../config/pacman.js";
import { CanvasComposite } from "../core/canvasComposite.js";
import { eventBus } from "../core/eventBus.js";
import type { Drawable, Updatable } from "../interfaces.js";
import { Vignette } from "../vfx/vignette.js";
import { Dot } from "../world/dot.js";
import { Maze } from "../world/maze.js";
import { Pill } from "../world/pill.js";

export class GameRegistry {
  private static instance: GameRegistry | null = null;

  private _vignette!: Vignette;
  private _pacman!: Pacman;
  private _ghosts: Ghost[] = [];
  private _ghostLayer!: CanvasComposite;
  private _maze!: Maze;
  private _dot!: Dot;
  private _pill!: Pill;

  private constructor() {
    this.initEventListeners();
  }

  static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }
    return GameRegistry.instance;
  }

  private initEventListeners(): void {
    eventBus.on("command:create_entities", () => this.createEntities());
    eventBus.on("command:reset_all", () => this.resetAll());
    eventBus.on("command:spawn_entities", () => this.spawnEntities());
    eventBus.on("command:exit_lair_all", () => this.exitLairAll());
    eventBus.on("command:init_all", () => this.initAll());
    eventBus.on("command:reset_positions", () => this.resetActors());
    eventBus.on("command:clear_canvases", () => this.clearAllCanvases());
  }

  createEntities(): void {
    this._vignette = new Vignette();
    this._maze = new Maze();
    this._dot = new Dot();
    this._pill = new Pill();
    this._pacman = new Pacman(CFG_PACMAN);

    // 1. Создаем один композитный слой для холста призраков
    this._ghostLayer = new CanvasComposite(CFG_CANVAS.canvasIds.ghosts);

    // 2. Создаем призраков, передавая им общий контекст этого слоя
    this._ghosts = Object.values(CFG_GHOSTS).map(
      (config) => new Ghost(config, this._ghostLayer.ctx),
    );

    // 3. Регистрируем призраков внутри композитного контейнера
    this._ghosts.forEach((ghost) => this._ghostLayer.add(ghost));
  }

  // --- Strict Type Getters ---
  getVignette(): Vignette {
    return this._vignette;
  }
  getPacman(): Pacman {
    return this._pacman;
  }
  getGhosts(): Ghost[] {
    return this._ghosts;
  }
  getMaze(): Maze {
    return this._maze;
  }
  getDots(): Dot {
    return this._dot;
  }
  getPills(): Pill {
    return this._pill;
  }

  /** * Combined arrays for direct GameLoop cycle access.
   */
  getAllUpdatable(): Updatable[] {
    return [this._vignette, this._pacman, ...this._ghosts, this._pill];
  }

  getAllDrawable(): Drawable[] {
    return [
      this._maze,
      this._dot,
      this._pill,
      this._vignette,
      this._pacman,
      this._ghostLayer,
    ];
  }

  // --- Polymorphic Group Iterations ---

  initAll(): void {
    this.getAllDrawable().forEach((entity) => entity.init?.());
  }

  resetAll(): void {
    this.getAllDrawable().forEach((entity) => entity.reset());
  }

  spawnEntities(): void {
    this._pacman.spawn();
    this._ghosts.forEach((g) => g.spawn());
  }

  exitLairAll(): void {
    this._ghosts.forEach((g) => g.calculateExitPath());
  }

  resetActors(): void {
    this._pacman.reset();
    this._ghosts.forEach((g) => g.reset());
  }

  clearAllCanvases(): void {
    this.getAllDrawable().forEach((entity) => entity.clearCanvas());
  }
}
