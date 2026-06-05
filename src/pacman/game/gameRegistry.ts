import { CFG_PACMAN } from "../config/pacman.config.js";
import { CFG_CANVAS } from "../config/canvas.config.js";
import { CFG_GHOSTS } from "../config/ghost.config.js";

import { CanvasComposite } from "../render/CanvasComposite.js";
import { eventBus } from "../core/EventBus.js";
import { Ghost } from "../actors/ghost/Ghost.js";
import { Pacman } from "../actors/pacman/Pacman.js";
import { Pill } from "../world/Pill.js";
import { Dot } from "../world/Dot.js";
import { Maze } from "../world/Maze.js";
import { Vignette } from "../vfx/Vignette.js";

import type { Drawable, Updatable } from "../shared/types.js";

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
    eventBus.on("command:create_all", () => this.createAll());
    eventBus.on("command:reset_all", () => this.resetAll());
    eventBus.on("command:spawn_actors", () => this.spawnActors());
    eventBus.on("command:exit_lair_all", () => this.exitLairAll());
    eventBus.on("command:init_all", () => this.initAll());
    eventBus.on("command:reset_actors", () => this.resetActors());
    eventBus.on("command:clear_canvases", () => this.clearAllCanvases());
  }

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

  createAll(): void {
    this._vignette = new Vignette();
    this._maze = new Maze();
    this._dot = new Dot();
    this._pill = new Pill();
    this._pacman = new Pacman(CFG_PACMAN);

    this._ghostLayer = new CanvasComposite(CFG_CANVAS.canvasIds.ghosts);

    this._ghosts = Object.values(CFG_GHOSTS).map(
      (config) => new Ghost(config, this._ghostLayer.ctx),
    );

    this._ghosts.forEach((ghost) => this._ghostLayer.add(ghost));
  }

  initAll(): void {
    this.getAllDrawable().forEach((entity) => entity.init?.());
  }

  resetAll(): void {
    this.getAllDrawable().forEach((entity) => entity.reset());
  }

  spawnActors(): void {
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
