// src/core/GameRegistry.ts

import { Ghost } from "../actors/ghost.js";
import { Pacman } from "../actors/pacman.js";
import { CFG_GHOSTS } from "../config/ghosts.js";
import { eventBus } from "../core/eventBus.js";
import type { Drawable, Updatable } from "../interfaces.js";
import { Dot } from "../world/dot.js";
import { Maze } from "../world/maze.js";
import { Pill } from "../world/pill.js";

/**
 * Central registry for actor entities.
 * Delegates world layer responsibilities out to the Environment system.
 */
export class GameRegistry {
  private static instance: GameRegistry | null = null;

  private _pacman!: Pacman;
  private _ghosts: Ghost[] = [];
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
    eventBus.on("command:reset_positions", () => this.resetPositionsForDeath());
    eventBus.on("command:clear_canvases", () => this.clearAllCanvases());
  }

  createEntities(): void {
    this._maze = new Maze();
    this._dot = new Dot();
    this._pill = new Pill();
    this._pacman = new Pacman();
    this._ghosts = Object.values(CFG_GHOSTS).map(
      ({ name, color }) => new Ghost(name, color),
    );
  }

  // --- Strict Type Getters ---
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

  /** Combined arrays for direct GameLoop cycle access */
  getAllUpdatable(): Updatable[] {
    return [this._pacman, ...this._ghosts, this._pill];
  }

  getAllDrawable(): Drawable[] {
    return [this._maze, this._dot, this._pill, this._pacman, ...this._ghosts];
  }

  initAll(): void {
    this._maze.init();
    this._dot.init();
    this._pill.init();
    this._pacman.init();
    this._ghosts.forEach((g) => g.init());
  }

  resetAll(): void {
    this._maze.reset();
    this._dot.reset();
    this._pill.reset();
    this._pacman.reset();
    this._ghosts.forEach((g) => g.reset());
  }

  spawnEntities(): void {
    this._pacman.spawn();
    this._ghosts.forEach((g) => g.spawn());
  }

  exitLairAll(): void {
    this._ghosts.forEach((g) => g.calculateExitPath());
  }

  resetPositionsForDeath(): void {
    this._pacman.reset();
    this._ghosts.forEach((g) => {
      g.spawn();
      g.reset();
    });
  }

  clearAllCanvases(): void {
    this._maze.clearCanvas();
    this._dot.clearCanvas();
    this._pill.clearCanvas();
    this._pacman.clearCanvas();
    this._ghosts.forEach((ghost) => ghost.clearCanvas());
  }
}
