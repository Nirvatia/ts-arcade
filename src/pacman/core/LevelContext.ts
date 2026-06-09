import type { GameState } from "../game/GameState.svelte.js";
import type { GridContext } from "./GridContext.js";
import type { Pacman } from "../actors/pacman/Pacman.js";
import type { Ghost } from "../actors/ghost/Ghost.js";
import type { PixiGrid } from "../world/PixiGrid.js";
import type { Dot } from "../world/Dot.js";
import type { Pill } from "../world/Pill.js";
import type { Vignette } from "../vfx/Vignette.js";
import type { IUpdatable, IDrawable } from "../shared/types.js";
import * as PIXI from "pixi.js";

export class LevelContext {
  private _pacman!: Pacman;
  private _ghosts: Ghost[] = [];
  private _pixiGrid!: PixiGrid;
  private _dot!: Dot;
  private _pill!: Pill;
  private _vignette!: Vignette;

  constructor(
    public readonly gameState: GameState,
    public readonly gridContext: GridContext,
    public readonly pixiApp: PIXI.Application
  ) {}

  public registerPacman(pacman: Pacman): void {
    this._pacman = pacman;
  }

  public setEnvironment(
    ghosts: Ghost[],
    pixiGrid: PixiGrid,
    dot: Dot,
    pill: Pill,
    vignette: Vignette,
  ): void {
    this._ghosts = ghosts;
    this._pixiGrid = pixiGrid;
    this._dot = dot;
    this._pill = pill;
    this._vignette = vignette;
  }

  public get pacman(): Pacman { return this._pacman; }
  public get ghosts(): Ghost[] { return this._ghosts; }
  public get pixiGrid(): PixiGrid { return this._pixiGrid; }
  public get dot(): Dot { return this._dot; }
  public get pill(): Pill { return this._pill; }
  public get vignette(): Vignette { return this._vignette; }

  public getAllUpdatable(): IUpdatable[] {
    return [
      this._pacman,
      ...this._ghosts,
      this._pill,
    ];
  }

  public getAllDrawable(): IDrawable[] {
    return [
      this._pixiGrid,
      this._dot,
      this._pill,
      this._vignette,
      this._pacman,
      ...this._ghosts
    ];
  }

  public resizeEnvironment(): void {
    // Pixi coordinates are updated explicitly in entity logic or stage scale configurations.
    // Dynamic container dimension transforms can be added here if window resizing is required.
  }

  public spawnAll(): void {
    this._dot.spawn();
    this._pill.spawn();
    this._pacman.spawn();
    this._ghosts.forEach((g) => g.spawn());
  }

  public exitLairAll(): void {
    this._ghosts.forEach((g) => g.calculateExitPath());
  }

  public clearAllCanvases(): void {
    // Pixi auto-clears frames; we flag assets as dirty to trigger redraw allocations
    this.getAllDrawable().forEach((entity) => entity.requestRedraw());
  }
}